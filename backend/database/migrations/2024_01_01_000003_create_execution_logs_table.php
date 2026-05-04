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
         * execution_logs
         * Raw ingestion table for payloads arriving from n8n webhooks or
         * any other orchestration tool. One row = one execution run.
         */
        Schema::create('execution_logs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique()->index();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();

            // Source metadata
            $table->string('source_tool', 50)->default('n8n'); // n8n | agno | zapier | custom
            $table->string('execution_id', 255)->nullable();   // External execution ID from the tool
            $table->string('workflow_name', 500)->nullable();  // n8n workflow name / Agno run name

            // Ingestion
            $table->json('raw_payload');                        // Full JSON received from webhook
            $table->json('extracted_path')->nullable();         // Normalized step-by-step path array

            // Timing
            $table->timestamp('executed_at')->nullable();       // When the agent actually ran
            $table->unsignedInteger('duration_ms')->nullable(); // Wall-clock duration

            // Processing state
            $table->enum('processing_status', [
                'pending',    // Received, not yet audited
                'auditing',   // Agno audit in-flight
                'completed',  // Audit finished
                'failed',     // Audit errored
            ])->default('pending')->index();

            $table->text('processing_error')->nullable();

            // Audit linkage (populated after audit)
            $table->unsignedInteger('drift_count')->default(0);
            $table->decimal('alignment_score', 5, 2)->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->string('webhook_secret_hash', 64)->nullable(); // SHA-256 of secret for verification
            $table->timestamps();

            $table->index(['project_id', 'processing_status', 'executed_at']);
            $table->index(['source_tool', 'execution_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('execution_logs');
    }
};
