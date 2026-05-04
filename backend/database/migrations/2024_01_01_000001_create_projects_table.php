<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique()->index();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('slug', 255)->unique();

            // BRD source metadata
            $table->string('brd_source_type', 50)->default('manual'); // manual | url | upload | webhook
            $table->string('brd_source_url', 2048)->nullable();
            $table->longText('brd_raw_content')->nullable();

            // Orchestration config
            $table->string('orchestration_tool', 50)->default('n8n'); // n8n | agno | zapier | custom
            $table->json('orchestration_config')->nullable(); // tool-specific config blob

            // Computed alignment score (cached, updated after each audit run)
            $table->decimal('alignment_score', 5, 2)->default(100.00); // 0-100
            $table->unsignedInteger('total_audits')->default(0);
            $table->unsignedInteger('total_drifts')->default(0);
            $table->unsignedInteger('critical_drifts')->default(0);

            $table->enum('status', ['active', 'paused', 'archived'])->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'alignment_score']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
