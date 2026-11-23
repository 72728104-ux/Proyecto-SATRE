<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassroomResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'grade_level' => $this->grade_level,
            'capacity' => $this->capacity,
            'academic_period' => $this->whenLoaded('academicPeriod', fn () => [
                'id' => $this->academicPeriod->id,
                'name' => $this->academicPeriod->name,
            ]),
            'tutor' => $this->whenLoaded('tutor', fn () => $this->tutor ? [
                'id' => $this->tutor->id,
                'name' => $this->tutor->user?->name,
            ] : null),
        ];
    }
}
