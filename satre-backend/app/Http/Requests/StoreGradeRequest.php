<?php

namespace App\Http\Requests;

use App\Models\Grade;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGradeRequest extends FormRequest
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
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'evaluation_name' => ['required', 'string', 'max:255'],
            'criterion' => ['nullable', 'string', Rule::in(Grade::CRITERIA)],
            'evaluation_date' => ['required', 'date'],
            'score' => ['required', 'integer', 'between:'.Grade::MIN_SCORE.','.Grade::MAX_SCORE],
        ];
    }
}
