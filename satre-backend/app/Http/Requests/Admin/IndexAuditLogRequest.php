<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class IndexAuditLogRequest extends FormRequest
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
            'user_id' => ['sometimes', 'integer'],
            'action' => ['sometimes', 'string', 'max:80'],
            'date_from' => ['sometimes', 'date'],
            'date_to' => array_filter(['sometimes', 'date', $this->filled('date_from') ? 'after_or_equal:date_from' : null]),
        ];
    }
}
