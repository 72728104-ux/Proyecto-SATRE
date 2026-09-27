<?php

namespace App\Http\Requests\Admin;

use App\Support\Roles;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', 'string', Rule::in(Roles::all())],
            'password' => ['nullable', 'string', 'min:10'],
            'profile' => [Rule::requiredIf($this->input('role') !== Roles::ADMIN), 'array'],
            ...$this->profileRules(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function profileRules(): array
    {
        return match ($this->input('role')) {
            Roles::TEACHER => [
                'profile.employee_code' => ['required', 'string', 'max:30', 'unique:teachers,employee_code'],
                'profile.specialty' => ['nullable', 'string', 'max:255'],
            ],
            Roles::MONITOR => [
                'profile.employee_code' => ['required', 'string', 'max:30', 'unique:monitors,employee_code'],
            ],
            Roles::STUDENT => [
                'profile.student_code' => ['required', 'string', 'max:30', 'unique:students,student_code'],
                'profile.document_number' => ['required', 'string', 'max:20', 'unique:students,document_number'],
                'profile.first_name' => ['required', 'string', 'max:255'],
                'profile.last_name' => ['required', 'string', 'max:255'],
                'profile.classroom_id' => ['nullable', 'integer', 'exists:classrooms,id'],
                'profile.is_boarder' => ['sometimes', 'boolean'],
            ],
            Roles::GUARDIAN => [
                'profile.document_number' => ['required', 'string', 'max:20', 'unique:guardians,document_number'],
                'profile.first_name' => ['required', 'string', 'max:255'],
                'profile.last_name' => ['required', 'string', 'max:255'],
                'profile.phone' => ['nullable', 'string', 'max:30'],
            ],
            default => [],
        };
    }
}
