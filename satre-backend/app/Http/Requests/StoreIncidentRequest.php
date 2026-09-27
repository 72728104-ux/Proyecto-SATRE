<?php

namespace App\Http\Requests;

use App\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIncidentRequest extends FormRequest
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
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'incident_at' => ['required', 'date'],
            'category' => ['required', 'string', Rule::in(Incident::CATEGORIES)],
            'severity' => ['required', 'string', Rule::in(Incident::SEVERITIES)],
            'description' => ['required', 'string', 'max:5000'],
        ];
    }
}
