<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * HTTP bridge from Laravel to the Python Agno audit microservice.
 * The Python FastAPI server wraps sla_audit_engine.py and exposes /audit.
 */
final class AgnoAuditBridgeService
{
    private readonly string $baseUrl;
    private readonly int $timeoutSeconds;

    public function __construct()
    {
        $this->baseUrl        = rtrim(config('sla.agno_service_url', 'http://localhost:8001'), '/');
        $this->timeoutSeconds = (int) config('sla.agno_timeout_seconds', 90);
    }

    /**
     * Calls POST /audit on the Agno FastAPI microservice.
     *
     * @return array<string, mixed>  Decoded AuditResult JSON
     * @throws \RuntimeException     If the service call fails after retries
     */
    public function audit(
        string $requirementString,
        string $actualPathString,
        int|null $projectId = null,
        int|null $executionLogId = null,
        string $orchestrationTool = 'n8n',
    ): array {
        $payload = [
            'requirement_string'  => $requirementString,
            'actual_path_string'  => $actualPathString,
            'project_id'          => $projectId,
            'execution_log_id'    => $executionLogId,
            'orchestration_tool'  => $orchestrationTool,
        ];

        try {
            $response = Http::timeout($this->timeoutSeconds)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("{$this->baseUrl}/audit", $payload)
                ->throw(); // Throws on 4xx/5xx

            return $response->json();
        } catch (ConnectionException $e) {
            Log::critical('Agno audit service unreachable', ['url' => $this->baseUrl, 'error' => $e->getMessage()]);
            throw new \RuntimeException("Agno audit service is unreachable: {$e->getMessage()}", previous: $e);
        } catch (\Throwable $e) {
            Log::error('Agno audit bridge error', ['error' => $e->getMessage()]);
            throw new \RuntimeException("Audit service error: {$e->getMessage()}", previous: $e);
        }
    }

    /**
     * Calls POST /parse-requirements on the Agno FastAPI microservice.
     */
    public function parseRequirements(string $brdText): array
    {
        try {
            $response = Http::timeout($this->timeoutSeconds)
                ->post("{$this->baseUrl}/parse-requirements", [
                    'brd_text' => $brdText
                ])
                ->throw();

            return $response->json();
        } catch (\Throwable $e) {
            Log::error('Agno parser bridge error', ['error' => $e->getMessage()]);
            throw new \RuntimeException("Requirement parsing failed: {$e->getMessage()}", previous: $e);
        }
    }
}
