<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequirementGraph extends Model
{
    protected $table = 'requirements_graph';

    protected $fillable = [
        'uuid',
        'project_id',
        'node_key',
        'node_label',
        'requirement_text',
        'section_reference',
        'embedding',
        'requirement_type',
        'priority',
        'category',
        'edges',
        'is_root',
        'is_terminal',
        'audit_hit_count',
        'audit_miss_count',
    ];

    protected $casts = [
        'embedding' => 'array',
        'edges'     => 'array',
        'is_root'   => 'boolean',
        'is_terminal' => 'boolean',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
