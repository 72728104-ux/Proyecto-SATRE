<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'student_id' => $this->student_id,
            'course_id' => $this->course_id,
            'course_name' => $this->whenLoaded('course', fn () => $this->course?->name),
            'academic_period_id' => $this->academic_period_id,
            'attendance_date' => $this->attendance_date?->toDateString(),
            'status' => $this->status,
            'notes' => $this->notes,
            'recorded_by' => $this->recorded_by,
        ];
    }
}
