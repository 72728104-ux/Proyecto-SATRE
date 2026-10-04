<?php

namespace App\Http\Resources;

use App\Support\Roles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuizAttemptResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $staff = $request->user()?->hasRole(Roles::ADMIN, Roles::TEACHER) ?? false;

        return [
            'id' => $this->id,
            'reading_material_id' => $this->reading_material_id,
            'student_id' => $this->student_id,
            'student_name' => $this->when(
                $staff && $this->relationLoaded('student'),
                fn () => trim($this->student->first_name.' '.$this->student->last_name)
            ),
            'score' => (float) $this->score,
            'total_questions' => $this->total_questions,
            'correct_count' => $this->correct_count,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'results' => $this->when(isset($this->results), $this->results),
        ];
    }
}
