<?php

namespace App\Http\Requests;

use App\Models\Grade;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateGradeRequest extends FormRequest
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
            'evaluation_name' => ['sometimes', 'required', 'string', 'max:255'],
            'criterion' => ['sometimes', 'nullable', 'string', Rule::in(Grade::CRITERIA)],
            'evaluation_date' => ['sometimes', 'required', 'date'],
            'score' => ['sometimes', 'required', 'integer', 'between:'.Grade::MIN_SCORE.','.Grade::MAX_SCORE],
        ];
    }
}
