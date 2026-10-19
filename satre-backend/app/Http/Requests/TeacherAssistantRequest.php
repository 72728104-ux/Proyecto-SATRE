<?php

namespace App\Http\Requests;

use App\Models\Grade;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeacherAssistantRequest extends FormRequest
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
            'classroom_id' => ['required', 'integer', 'exists:classrooms,id'],
            'student_id' => ['nullable', 'integer', 'exists:students,id'],
            'message' => ['required', 'string', 'max:1000'],
            'criterion' => ['nullable', 'string', Rule::in(Grade::CRITERIA)],
            'history' => ['nullable', 'array', 'max:20'],
            'history.*.role' => ['required_with:history', 'string', Rule::in(['user', 'teacher', 'assistant', 'model'])],
            'history.*.content' => ['required_with:history', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'classroom_id' => 'aula',
            'student_id' => 'estudiante',
            'message' => 'consulta',
            'criterion' => 'criterio',
            'history' => 'historial',
        ];
    }
}
