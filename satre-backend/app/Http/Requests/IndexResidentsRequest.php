<?php

namespace App\Http\Requests;

use App\Models\ResidentialPresence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexResidentsRequest extends FormRequest
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
            'search' => ['nullable', 'string', 'max:100'],
            'presence_date' => ['nullable', 'date'],
            'check_type' => ['nullable', 'string', Rule::in(ResidentialPresence::CHECK_TYPES)],
        ];
    }
}
