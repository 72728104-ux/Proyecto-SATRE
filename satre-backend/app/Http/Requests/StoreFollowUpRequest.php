<?php

namespace App\Http\Requests;

use App\Models\FollowUp;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFollowUpRequest extends FormRequest
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
            'follow_up_date' => ['required', 'date', 'before_or_equal:today'],
            'outcome' => ['nullable', 'string', Rule::in(FollowUp::OUTCOMES)],
            'notes' => ['required', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'follow_up_date' => 'fecha de seguimiento',
            'outcome' => 'resultado',
            'notes' => 'notas',
        ];
    }
}
