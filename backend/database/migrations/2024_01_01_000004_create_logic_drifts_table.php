<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /**
         * logic_drifts
         * One row per detected discrepancy between BRD requirements and agent execution.
         * Multiple drifts can belong to a single execution_log.
         */
        Schema::create('logic_drifts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique()->index();
            $table->foreignId('execution_log_id')->constrained('execution_logs')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();

            // Which requirement was violated
            $table->foreignId('requirement_node_id')
                ->nullable()
                ->constrained('requirements_graph')
                ->nullOnDelete();
            $table->string('requirement_node_key', 100)->nullable(); // Denormalized for fast reads

            // Drift classification
            $table->enum('drift_type', [
                'skipped_step',          // A mandatory step was completely omitted
                'wrong_order',           // Steps executed out of required sequence
                'constraint_violated',   // A MUST NOT rule was triggered
                'incomplete_execution',  // Chain stopped before reaching terminal node
                'unexpected_branch',     // Agent took an undocumented path
                'data_integrity_fail',   // Output data violates a schema constraint
            ]);

            $table->enum('severity', ['critical', 'high', 'medium', 'low'])->default('high');

            // AI-generated audit output
            $table->text('brd_expectation');     // What the BRD expected
            $table->text('actual_behaviour');    // What the agent actually did
            $table->text('ai_explanation');      // LLM-generated explanation of the drift
            $table->text('remediation_hint')->nullable(); // LLM-generated fix suggestion

            // Semantic similarity score between expectation and actual (0-1)
            $table->decimal('similarity_score', 4, 3)->nullable();

            // Resolution workflow
            $table->enum('resolution_status', [
                'open',
                'acknowledged',
                'resolved',
                'accepted_risk',  // Deliberate deviation, documented
                'false_positive',
            ])->default('open')->index();

            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();

            $table->timestamps();

            $table->index(['project_id', 'severity', 'resolution_status']);
            $table->index(['drift_type', 'severity']);
            $table->index(['execution_log_id', 'drift_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logic_drifts');
    }
};
