<?php

namespace App\Http\Requests;

use App\Models\ReadingMaterial;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateReadingRequest extends FormRequest
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
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'criterion' => ['sometimes', 'nullable', 'string', Rule::in(ReadingMaterial::CRITERIA)],
            'content' => ['sometimes', 'nullable', 'string'],
            'url' => ['sometimes', 'nullable', 'url', 'max:255'],
        ];
    }
}
