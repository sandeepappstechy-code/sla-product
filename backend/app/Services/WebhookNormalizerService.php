<?php

declare(strict_types=1);

namespace App\Services;

use InvalidArgumentException;

/**
 * Normalises heterogeneous webhook payloads from different orchestration tools
 * into a canonical step-array structure used by the audit engine.
 *
 * To add a new tool, implement a private normaliseXxx() method and
 * add its key to the $handlers map. No other code changes needed.
 */
final class WebhookNormalizerService
{
    /** @var array<string, callable> */
    private array $handlers;

    public function __construct()
    {
        $this->handlers = [
            'n8n'    => $this->normaliseN8n(...),
            'agno'   => $this->normaliseAgno(...),
            'zapier' => $this->normaliseZapier(...),
            'custom' => $this->normaliseCustom(...),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>  Canonical normalised structure
     */
    public function normalise(string $tool, array $payload): array
    {
        if (!isset($this->handlers[$tool])) {
            throw new InvalidArgumentException("No normaliser registered for tool: {$tool}");
        }

        return ($this->handlers[$tool])($payload);
    }

    // ──────────────────────────────────────────────────────────
    // n8n Normaliser
    // Expects n8n execution webhook format
    // ──────────────────────────────────────────────────────────
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normaliseN8n(array $payload): array
    {
        $nodes = $payload['data']['executionData']['nodeExecutionOrder'] ?? [];

        $steps = array_values(array_map(function (array $node, int $idx): array {
            return [
                'sequence'   => $idx + 1,
                'action'     => $node['node']['name'] ?? 'Unknown Node',
                'tool_used'  => $node['node']['type'] ?? 'unknown',
                'outcome'    => $node['executionStatus'] ?? 'unknown',
                'duration_ms'=> $node['executionTime'] ?? null,
                'metadata'   => $node['data'] ?? null,
            ];
        }, $nodes, array_keys($nodes)));

        return [
            'execution_id'  => $payload['data']['id'] ?? null,
            'workflow_name' => $payload['data']['workflowData']['name'] ?? null,
            'executed_at'   => $payload['data']['startedAt'] ?? null,
            'duration_ms'   => $payload['data']['stoppedAt']
                ? (int) ((strtotime($payload['data']['stoppedAt']) - strtotime($payload['data']['startedAt'] ?? 'now')) * 1000)
                : null,
            'steps' => $steps,
        ];
    }

    // ──────────────────────────────────────────────────────────
    // Agno Normaliser
    // ──────────────────────────────────────────────────────────
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normaliseAgno(array $payload): array
    {
        $messages = $payload['messages'] ?? $payload['steps'] ?? [];

        $steps = array_values(array_map(function (array $msg, int $idx): array {
            return [
                'sequence'  => $idx + 1,
                'action'    => $msg['role'] ?? 'step',
                'tool_used' => $msg['tool_name'] ?? 'llm',
                'outcome'   => $msg['content'] ?? '',
                'metadata'  => $msg['metadata'] ?? null,
            ];
        }, $messages, array_keys($messages)));

        return [
            'execution_id'  => $payload['run_id'] ?? null,
            'workflow_name' => $payload['agent_name'] ?? null,
            'executed_at'   => $payload['created_at'] ?? null,
            'duration_ms'   => $payload['duration_ms'] ?? null,
            'steps'         => $steps,
        ];
    }

    // ──────────────────────────────────────────────────────────
    // Zapier Normaliser
    // ──────────────────────────────────────────────────────────
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normaliseZapier(array $payload): array
    {
        return [
            'execution_id'  => $payload['id'] ?? null,
            'workflow_name' => $payload['zap_name'] ?? null,
            'executed_at'   => $payload['attempt']['date_sent'] ?? null,
            'duration_ms'   => null,
            'steps'         => [
                [
                    'sequence'  => 1,
                    'action'    => 'zap_trigger',
                    'tool_used' => 'zapier',
                    'outcome'   => json_encode($payload['data'] ?? []),
                    'metadata'  => null,
                ],
            ],
        ];
    }

    // ──────────────────────────────────────────────────────────
    // Custom / Generic Normaliser
    // Expects our own canonical schema directly
    // ──────────────────────────────────────────────────────────
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normaliseCustom(array $payload): array
    {
        return [
            'execution_id'  => $payload['execution_id'] ?? null,
            'workflow_name' => $payload['workflow_name'] ?? 'Custom Workflow',
            'executed_at'   => $payload['executed_at'] ?? null,
            'duration_ms'   => $payload['duration_ms'] ?? null,
            'steps'         => $payload['steps'] ?? [],
        ];
    }
}
