<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\ExecutionLog;
use App\Models\LogicDrift;
use App\Models\Project;
use App\Services\AgnoAuditBridgeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Async job that calls the Agno Python audit engine via HTTP bridge
 * and persists all detected drifts into the database.
 */
final class RunSlaAuditJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Retry twice if the Agno service is temporarily unavailable */
    public int $tries = 3;

    /** Back off 10s, then 30s on retry */
    public array $backoff = [10, 30];

    /** Max wall-clock time before the job is force-killed */
    public int $timeout = 120;

    public function __construct(
        public readonly int $executionLogId,
    ) {}

    public function handle(AgnoAuditBridgeService $agno): void
    {
        $log = ExecutionLog::with('project.requirementsGraph')->findOrFail($this->executionLogId);

        // Mark as in-flight
        $log->update(['processing_status' => 'auditing']);

        try {
            // Build the requirement string from the linked project's BRD
            $requirementString = $log->project->brd_raw_content
                ?? $this->buildRequirementFromGraph($log->project);

            // Build the actual path string from the normalised steps
            $actualPathString = $this->buildActualPathString($log->extracted_path ?? []);

            // Call Agno audit engine
            $auditResult = $agno->audit(
                requirementString: $requirementString,
                actualPathString: $actualPathString,
                projectId: $log->project_id,
                executionLogId: $log->id,
                orchestrationTool: $log->source_tool,
            );

            // Persist drifts + update log atomically
            DB::transaction(function () use ($log, $auditResult): void {
                $criticalCount = 0;

                foreach ($auditResult['drifts'] as $drift) {
                    if ($drift['severity'] === 'critical') {
                        $criticalCount++;
                    }

                    LogicDrift::create([
                        'uuid'                  => Str::uuid()->toString(),
                        'execution_log_id'      => $log->id,
                        'project_id'            => $log->project_id,
                        'requirement_node_key'  => $drift['requirement_reference'] ?? null,
                        'drift_type'            => $drift['drift_type'],
                        'severity'              => $drift['severity'],
                        'brd_expectation'       => $drift['brd_expectation'],
                        'actual_behaviour'      => $drift['actual_behaviour'],
                        'ai_explanation'        => $drift['ai_explanation'],
                        'remediation_hint'      => $drift['remediation_hint'],
                        'similarity_score'      => $drift['similarity_score'],
                        'resolution_status'     => 'open',
                    ]);
                }

                $driftCount = count($auditResult['drifts']);

                $log->update([
                    'processing_status' => 'completed',
                    'drift_count'       => $driftCount,
                    'alignment_score'   => $auditResult['alignment_score'],
                ]);

                // Update project-level aggregates
                $log->project->increment('total_drifts', $driftCount);
                $log->project->increment('critical_drifts', $criticalCount);

                // Recalculate project alignment score as rolling average
                $avgScore = ExecutionLog::where('project_id', $log->project_id)
                    ->whereNotNull('alignment_score')
                    ->avg('alignment_score');

                $log->project->update(['alignment_score' => round((float) $avgScore, 2)]);
            });

            Log::info('SLA audit completed', [
                'execution_log_id' => $log->id,
                'alignment_score'  => $auditResult['alignment_score'],
                'drift_count'      => count($auditResult['drifts']),
            ]);
        } catch (\Throwable $e) {
            $log->update([
                'processing_status' => 'failed',
                'processing_error'  => $e->getMessage(),
            ]);

            Log::error('SLA audit job failed', [
                'execution_log_id' => $this->executionLogId,
                'error'            => $e->getMessage(),
                'trace'            => $e->getTraceAsString(),
            ]);

            throw $e; // Re-throw so the queue retries
        }
    }

    private function buildRequirementFromGraph(Project $project): string
    {
        return $project->requirementsGraph
            ->sortBy('id')
            ->map(fn ($node) => "[{$node->priority}] {$node->node_label}: {$node->requirement_text}")
            ->implode("\n");
    }

    private function buildActualPathString(array $steps): string
    {
        if (empty($steps)) {
            return 'No execution steps recorded.';
        }

        return collect($steps)
            ->map(fn ($step, $i) => sprintf(
                'Step %d: %s — %s',
                $i + 1,
                $step['action'] ?? 'Unknown action',
                $step['outcome'] ?? 'No outcome recorded',
            ))
            ->implode("\n");
    }
}
