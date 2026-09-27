<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GradeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'student_id' => $this->student_id,
            'student_name' => $this->whenLoaded('student', fn () => trim($this->student->first_name.' '.$this->student->last_name)),
            'course_id' => $this->course_id,
            'course_name' => $this->whenLoaded('course', fn () => $this->course->name),
            'academic_period_id' => $this->academic_period_id,
            'evaluation_name' => $this->evaluation_name,
            'criterion' => $this->criterion,
            'evaluation_date' => $this->evaluation_date?->toDateString(),
            'score' => $this->score,
            'max_score' => $this->max_score,
            'recorded_by' => $this->recorded_by,
        ];
    }
}
