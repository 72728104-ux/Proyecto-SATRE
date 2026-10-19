<?php

namespace App\Http\Requests;

use App\Support\InstitutionalIdentity;
use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'max:255', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! is_string($value) || ! InstitutionalIdentity::isLoginIdentifier(trim($value))) {
                    $fail('Ingresa tu correo institucional o tu DNI de 8 dígitos.');
                }
            }],
            'password' => ['required', 'string'],
        ];
    }
}
