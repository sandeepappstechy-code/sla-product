<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogicDrift extends Model
{
    protected $fillable = [
        'uuid',
        'execution_log_id',
        'project_id',
        'requirement_node_key',
        'drift_type',
        'severity',
        'brd_expectation',
        'actual_behaviour',
        'ai_explanation',
        'remediation_hint',
        'similarity_score',
        'resolution_status',
    ];

    public function executionLog(): BelongsTo
    {
        return $this->belongsTo(ExecutionLog::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
