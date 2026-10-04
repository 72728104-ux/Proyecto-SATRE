<?php

namespace App\Http\Requests;

use App\Models\ReadingMaterial;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReadingRequest extends FormRequest
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
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'title' => ['required', 'string', 'max:255'],
            'criterion' => ['nullable', 'string', Rule::in(ReadingMaterial::CRITERIA)],
            'content' => ['nullable', 'string'],
            'url' => ['nullable', 'url', 'max:255'],
        ];
    }
}
