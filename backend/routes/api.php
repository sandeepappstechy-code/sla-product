<?php

use App\Http\Controllers\Api\RequirementIngestionController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('webhooks')->group(function () {
    Route::post('{project:uuid}/{tool}', [WebhookController::class, 'ingest']);
    Route::get('{uuid}/status', [WebhookController::class, 'status']);
});

Route::prefix('requirements')->group(function () {
    Route::post('ingest', [RequirementIngestionController::class, 'parseAndStore']);
});

Route::options('{any}', function () {
    return response()->json([], 204)->withHeaders([
        'Access-Control-Allow-Origin'  => '*',
        'Access-Control-Allow-Methods' => 'POST, GET, OPTIONS, DELETE',
        'Access-Control-Allow-Headers' => 'Content-Type, X-Requested-With, Authorization'
    ]);
})->where('any', '.*');
