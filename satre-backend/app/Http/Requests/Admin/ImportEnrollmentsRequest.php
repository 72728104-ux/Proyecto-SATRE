<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ImportEnrollmentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * CSV con cabecera `student_code,course_code`; los cursos se buscan en `academic_period_id`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
            'academic_period_id' => ['required', 'integer', 'exists:academic_periods,id'],
        ];
    }
}
