<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AcademicPeriodRequest extends FormRequest
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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';
        $startDate = $this->input('start_date', $this->route('period')?->start_date?->toDateString());

        return [
            'name' => [$required, 'string', 'max:255'],
            'start_date' => [$required, 'date'],
            'end_date' => array_filter([$required, 'date', $startDate ? 'after_or_equal:'.$startDate : null]),
        ];
    }
}
