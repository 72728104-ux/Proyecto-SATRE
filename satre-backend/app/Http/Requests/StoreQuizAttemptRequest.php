<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreQuizAttemptRequest extends FormRequest
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
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.guided_question_id' => ['required', 'integer', 'distinct', 'exists:guided_questions,id'],
            'answers.*.response' => ['required', 'string', 'max:2000'],
        ];
    }
}
