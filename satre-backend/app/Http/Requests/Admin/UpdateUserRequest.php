<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
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
        $user = $this->route('user');
        $user?->loadMissing(['student', 'teacher']);

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'dni' => [
                'sometimes',
                'required',
                'digits:8',
                Rule::unique('users', 'dni')->ignore($user),
                Rule::unique('students', 'dni')->ignore($user?->student?->id),
                Rule::unique('teachers', 'dni')->ignore($user?->teacher?->id),
            ],
        ];
    }
}
