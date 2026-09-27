<?php

namespace App\Http\Requests;

use App\Models\ResidentialPresence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBulkPresenceRequest extends FormRequest
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
            'presence_date' => ['required', 'date'],
            'check_type' => ['required', 'string', Rule::in(ResidentialPresence::CHECK_TYPES)],
            'records' => ['required', 'array', 'min:1', 'max:100'],
            'records.*.student_id' => ['required', 'integer', 'distinct', 'exists:students,id'],
            'records.*.status' => ['required', 'string', Rule::in(ResidentialPresence::STATUSES)],
            'records.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
