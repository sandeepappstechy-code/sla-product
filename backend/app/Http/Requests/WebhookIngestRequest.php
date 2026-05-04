<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WebhookIngestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Payloads are dynamic, but we can check for common fields if needed.
            // For now, allow everything as the controller handles tool-specific logic.
        ];
    }
}
