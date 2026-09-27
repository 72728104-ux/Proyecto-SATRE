<?php

namespace App\Http\Requests;

use App\Models\ResidentialPresence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePresenceRequest extends FormRequest
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
            'status' => ['sometimes', 'required', 'string', Rule::in(ResidentialPresence::STATUSES)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
