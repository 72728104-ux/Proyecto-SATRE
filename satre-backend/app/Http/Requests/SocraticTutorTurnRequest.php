<?php

namespace App\Http\Requests;

use App\Models\ReadingMaterial;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SocraticTutorTurnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Sin `session_id` se inicia una sesión nueva; con él, el curso y el tema salen de la sesión.
     * `criterion` (A–D) es opcional al iniciar: viene del `reading_material` en el paso 5 (§12.2).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'session_id' => ['nullable', 'integer', 'exists:tutor_sessions,id'],
            'course_id' => ['required_without:session_id', 'nullable', 'integer', 'exists:courses,id'],
            'topic' => ['required_without:session_id', 'nullable', 'string', 'max:150'],
            'criterion' => ['nullable', 'string', Rule::in(ReadingMaterial::CRITERIA)],
            'message' => ['nullable', 'string', 'max:1000'],
            'option_id' => ['nullable', 'string', 'max:10'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'course_id' => 'curso',
            'topic' => 'tema',
            'criterion' => 'criterio',
            'message' => 'mensaje',
            'session_id' => 'sesión',
        ];
    }
}
