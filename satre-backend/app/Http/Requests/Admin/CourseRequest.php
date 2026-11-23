<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CourseRequest extends FormRequest
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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';
        $course = $this->route('course');
        $periodId = $this->input('academic_period_id', $course?->academic_period_id);

        return [
            'code' => [
                $required, 'string', 'max:30',
                Rule::unique('courses', 'code')->where('academic_period_id', $periodId)->ignore($course),
            ],
            'name' => [$required, 'string', 'max:255'],
            'classroom_id' => [$required, 'integer', 'exists:classrooms,id'],
            'teacher_id' => [$required, 'integer', 'exists:teachers,id'],
            'academic_period_id' => [$required, 'integer', 'exists:academic_periods,id'],
        ];
    }
}
