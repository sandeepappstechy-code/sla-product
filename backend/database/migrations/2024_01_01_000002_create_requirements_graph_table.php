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
         * requirements_graph
         * Stores a directed graph of business requirements extracted from a BRD.
         * Each row is one node. Edges are represented in the `edges` JSON column
         * as an array of { to: node_id, type: "sequence|condition|optional" }.
         */
        Schema::create('requirements_graph', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique()->index();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();

            // Node identity
            $table->string('node_key', 100);          // machine-readable key, e.g. "validate_user_identity"
            $table->string('node_label', 500);         // human-readable label from BRD
            $table->text('requirement_text');           // raw requirement text extracted from BRD
            $table->string('section_reference', 255)->nullable(); // BRD section, e.g. "§3.2.1"

            // Semantic embedding (stored as JSON array for portability; use pgvector extension in prod)
            $table->json('embedding')->nullable();      // float[] from LLM embeddings model

            // Requirement classification
            $table->enum('requirement_type', [
                'mandatory',   // MUST happen
                'conditional', // IF X THEN Y
                'optional',    // SHOULD happen
                'constraint',  // MUST NOT happen
                'outcome',     // Expected final state
            ])->default('mandatory');

            $table->enum('priority', ['critical', 'high', 'medium', 'low'])->default('high');

            // Graph edges stored as JSON
            // Format: [{"to_node_key": "...", "edge_type": "sequence|condition|optional", "condition_text": "..."}]
            $table->json('edges')->nullable();

            // Audit state
            $table->boolean('is_root')->default(false);  // Entry point of the requirement chain
            $table->boolean('is_terminal')->default(false); // Exit point / success state

            $table->unsignedInteger('audit_hit_count')->default(0);   // Times this node was matched
            $table->unsignedInteger('audit_miss_count')->default(0);  // Times this node was skipped

            $table->timestamps();

            $table->unique(['project_id', 'node_key'], 'uq_project_node_key');
            $table->index(['project_id', 'requirement_type', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('requirements_graph');
    }
};
