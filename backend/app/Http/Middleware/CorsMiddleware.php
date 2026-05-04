<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CorsMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // Handle OPTIONS preflight requests
        if ($request->isMethod('OPTIONS')) {
            return response('', 204)
                ->header('Access-Control-Allow-Origin',  '*')
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-SLA-Signature, Accept');
        }

        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            // If an exception occurs, let Laravel handle it but ensure we add CORS headers to the resulting response
            $response = app(\Illuminate\Contracts\Debug\ExceptionHandler::class)->render($request, $e);
        }

        $response->headers->set('Access-Control-Allow-Origin',  '*');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-SLA-Signature, Accept');

        return $response;
    }
}
