<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGuidedResponseRequest extends FormRequest
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
            'guided_question_id' => ['required', 'integer', 'exists:guided_questions,id'],
            'response' => ['required', 'string', 'max:2000'],
        ];
    }
}
