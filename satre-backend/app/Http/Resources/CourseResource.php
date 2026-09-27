<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'classroom' => [
                'id' => $this->classroom?->id,
                'name' => $this->classroom?->name,
                'grade_level' => $this->classroom?->grade_level,
            ],
        ];
    }
}
