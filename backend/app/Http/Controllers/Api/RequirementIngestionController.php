<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\RequirementGraph;
use App\Services\AgnoAuditBridgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RequirementIngestionController extends Controller
{
    public function __construct(
        private readonly AgnoAuditBridgeService $agno
    ) {}

    /**
     * POST /api/requirements/ingest
     * 
     * Ingests a BRD file or raw text, calls Agno to parse it, 
     * and saves the requirements to the requirements_graph table.
     */
    public function parseAndStore(Request $request): JsonResponse
    {
        \Log::info('Ingestion request received', [
            'project_uuid' => $request->project_uuid,
            'has_file'     => $request->hasFile('brd_file'),
            'has_text'     => $request->has('brd_text'),
        ]);

        $request->validate([
            'project_uuid' => 'required|uuid|exists:projects,uuid',
            'brd_text'     => 'required_without:brd_file|string',
            'brd_file'     => 'required_without:brd_text|file', // Removed mimes check for now to debug
        ]);

        $project = Project::where('uuid', $request->project_uuid)->firstOrFail();

        // 1. Get raw content
        $content = $request->brd_text;
        if ($request->hasFile('brd_file')) {
            $content = file_get_contents($request->file('brd_file')->path());
        }

        try {
            // 2. Call Agno to parse
            $parsedData = $this->agno->parseRequirements($content);

            // 3. Store in database
            DB::transaction(function () use ($project, $parsedData, $content) {
                // Update project with raw content
                $project->update(['brd_raw_content' => $content]);

                // Clear existing graph for this project if re-uploading
                $project->requirementsGraph()->delete();

                foreach ($parsedData['requirements'] as $req) {
                    RequirementGraph::create([
                        'uuid'               => Str::uuid()->toString(),
                        'project_id'         => $project->id,
                        'node_key'           => $req['node_key'],
                        'node_label'         => $req['node_label'],
                        'requirement_text'   => $req['requirement_text'],
                        'requirement_type'   => strtolower($req['requirement_type'] ?? 'mandatory'),
                        'priority'           => strtolower($req['priority'] ?? 'high'),
                        'category'           => $req['category'] ?? 'Functional',
                        'section_reference'  => $req['section_reference'] ?? null,
                    ]);
                }
            });

            return response()->json([
                'success'      => true,
                'raw_content'  => $content,
                'requirements' => $parsedData['requirements'],
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to ingest BRD: ' . $e->getMessage()
            ], 500);
        }
    }
}
