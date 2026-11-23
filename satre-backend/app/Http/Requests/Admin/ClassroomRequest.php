<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ClassroomRequest extends FormRequest
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

        return [
            'name' => [$required, 'string', 'max:255'],
            'grade_level' => [$required, 'string', 'max:30'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'academic_period_id' => [$required, 'integer', 'exists:academic_periods,id'],
            'tutor_id' => ['nullable', 'integer', 'exists:teachers,id'],
        ];
    }
}
