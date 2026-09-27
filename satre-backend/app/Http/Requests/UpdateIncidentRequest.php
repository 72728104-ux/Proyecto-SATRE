<?php

namespace App\Http\Requests;

use App\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'incident_at' => ['sometimes', 'required', 'date'],
            'category' => ['sometimes', 'required', 'string', Rule::in(Incident::CATEGORIES)],
            'severity' => ['sometimes', 'required', 'string', Rule::in(Incident::SEVERITIES)],
            'description' => ['sometimes', 'required', 'string', 'max:5000'],
            'status' => ['sometimes', 'required', 'string', Rule::in(Incident::STATUSES)],
        ];
    }
}
