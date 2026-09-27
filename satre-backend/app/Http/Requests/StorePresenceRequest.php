<?php

namespace App\Http\Requests;

use App\Models\ResidentialPresence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePresenceRequest extends FormRequest
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
            'presence_date' => ['required', 'date'],
            'check_type' => ['required', 'string', Rule::in(ResidentialPresence::CHECK_TYPES)],
            'status' => ['required', 'string', Rule::in(ResidentialPresence::STATUSES)],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
