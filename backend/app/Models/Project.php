<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'slug',
        'description',
        'brd_raw_content',
        'orchestration_tool',
        'orchestration_config',
        'alignment_score',
        'total_audits',
        'total_drifts',
        'critical_drifts',
    ];

    protected $casts = [
        'orchestration_config' => 'array',
    ];

    public function requirementsGraph(): HasMany
    {
        return $this->hasMany(RequirementGraph::class);
    }
}
