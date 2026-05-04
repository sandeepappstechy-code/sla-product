<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WebhookIngestRequest;
use App\Jobs\RunSlaAuditJob;
use App\Models\ExecutionLog;
use App\Models\Project;
use App\Services\WebhookNormalizerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Handles incoming webhook payloads from n8n, Agno, or any other orchestration tool.
 * Each tool sends a different payload shape; normalisation is handled by WebhookNormalizerService.
 */
final class WebhookController extends Controller
{
    public function __construct(
        private readonly WebhookNormalizerService $normalizer,
    ) {}

    /**
     * POST /api/webhooks/{project:uuid}/{tool}
     *
     * @param  WebhookIngestRequest  $request  Validated, rate-limited request
     * @param  Project               $project   Route-model bound by UUID
     * @param  string                $tool      n8n | agno | zapier | custom
     */
    public function ingest(
        Request $request,
        Project $project,
        string $tool,
    ): JsonResponse {
        // ── 1. Validate the webhook secret (HMAC-SHA256) ──────────────────
        $secret = $project->orchestration_config['webhook_secret'] ?? null;

        if ($secret !== null && !$this->verifyHmac($request, $secret)) {
            Log::warning('SLA webhook HMAC mismatch', [
                'project_uuid' => $project->uuid,
                'tool'         => $tool,
                'ip'           => $request->ip(),
            ]);

            return response()->json([
                'error' => 'Webhook signature verification failed.',
                'code'  => 'HMAC_MISMATCH',
            ], 401);
        }

        // ── 2. Validate tool is known ──────────────────────────────────────
        $allowedTools = ['n8n', 'agno', 'zapier', 'custom'];
        if (!in_array($tool, $allowedTools, true)) {
            return response()->json([
                'error' => "Unknown orchestration tool: {$tool}.",
                'code'  => 'UNKNOWN_TOOL',
            ], 422);
        }

        // ── 3. Normalise the raw payload into a canonical path array ──────
        $rawPayload = $request->all();

        try {
            $normalised = $this->normalizer->normalise(tool: $tool, payload: $rawPayload);
        } catch (\Throwable $e) {
            Log::error('SLA webhook normalisation failed', [
                'project_uuid' => $project->uuid,
                'tool'         => $tool,
                'error'        => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Payload normalisation failed: ' . $e->getMessage(),
                'code'  => 'NORMALISATION_ERROR',
            ], 422);
        }

        // ── 4. Persist the raw execution log (atomic write) ───────────────
        $executionLog = DB::transaction(function () use (
            $project,
            $tool,
            $rawPayload,
            $normalised,
            $request,
            $secret,
        ): ExecutionLog {
            $log = ExecutionLog::create([
                'uuid'                 => Str::uuid()->toString(),
                'project_id'           => $project->id,
                'source_tool'          => $tool,
                'execution_id'         => $normalised['execution_id'] ?? null,
                'workflow_name'        => $normalised['workflow_name'] ?? null,
                'raw_payload'          => $rawPayload,
                'extracted_path'       => $normalised['steps'] ?? null,
                'executed_at'          => $normalised['executed_at'] ?? now(),
                'duration_ms'          => $normalised['duration_ms'] ?? null,
                'processing_status'    => 'pending',
                'ip_address'           => $request->ip(),
                'webhook_secret_hash'  => $secret ? hash('sha256', $secret) : null,
            ]);

            // Bump project counters immediately for real-time dashboard accuracy
            $project->increment('total_audits');

            return $log;
        });

        // ── 5. Dispatch async audit job (non-blocking) ────────────────────
        RunSlaAuditJob::dispatch($executionLog->id)->onQueue('audits');

        Log::info('SLA webhook ingested successfully', [
            'execution_log_id' => $executionLog->id,
            'project_uuid'     => $project->uuid,
            'tool'             => $tool,
        ]);

        return response()->json([
            'message'          => 'Execution log received. Audit queued.',
            'execution_log_id' => $executionLog->uuid,
            'status'           => 'pending',
            'audit_eta_ms'     => 5000, // expected SLA for audit completion
        ], 202);
    }

    /**
     * GET /api/webhooks/{execution_log:uuid}/status
     *
     * Allows n8n to poll audit status after dispatch.
     */
    public function status(string $uuid): JsonResponse
    {
        $log = ExecutionLog::with('logicDrifts:id,execution_log_id,drift_type,severity,brd_expectation,actual_behaviour')
            ->where('uuid', $uuid)
            ->firstOrFail();

        return response()->json([
            'execution_log_id' => $log->uuid,
            'status'           => $log->processing_status,
            'alignment_score'  => $log->alignment_score,
            'drift_count'      => $log->drift_count,
            'drifts'           => $log->logicDrifts,
        ]);
    }

    // ──────────────────────────────────────────────────────────
    // Private Helpers
    // ──────────────────────────────────────────────────────────

    /**
     * Verifies n8n-style HMAC-SHA256 webhook signature.
     * Header: X-SLA-Signature: sha256=<hex_digest>
     */
    private function verifyHmac(Request $request, string $secret): bool
    {
        $signatureHeader = $request->header('X-SLA-Signature', '');

        if (!str_starts_with($signatureHeader, 'sha256=')) {
            return false;
        }

        $receivedHash = substr($signatureHeader, 7);
        $computedHash = hash_hmac('sha256', $request->getContent(), $secret);

        return hash_equals($computedHash, $receivedHash);
    }
}
