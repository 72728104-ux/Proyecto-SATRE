<?php

namespace App\Http\Resources;

use App\Support\Roles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncidentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $restricted = $request->user()?->hasRole(Roles::GUARDIAN) ?? false;

        return [
            'id' => $this->id,
            'student_id' => $this->student_id,
            'student_name' => $this->whenLoaded('student', fn () => trim($this->student->first_name.' '.$this->student->last_name)),
            'incident_at' => $this->incident_at?->toIso8601String(),
            'category' => $this->category,
            'severity' => $this->severity,
            'description' => $this->when(! $restricted, $this->description),
            'status' => $this->status,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'reported_by' => $this->when(! $restricted, $this->reported_by),
        ];
    }
}
