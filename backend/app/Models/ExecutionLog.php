<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExecutionLog extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'source_tool',
        'execution_id',
        'workflow_name',
        'raw_payload',
        'extracted_path',
        'executed_at',
        'duration_ms',
        'processing_status',
        'processing_error',
        'alignment_score',
        'drift_count',
        'ip_address',
        'webhook_secret_hash',
    ];

    protected $casts = [
        'raw_payload'    => 'array',
        'extracted_path' => 'array',
        'executed_at'    => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function logicDrifts(): HasMany
    {
        return $this->hasMany(LogicDrift::class);
    }
}
