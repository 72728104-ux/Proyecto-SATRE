<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AlertResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $reduced = [
            'id' => $this->id,
            'student_id' => $this->student_id,
            'severity' => $this->severity,
            'message' => $this->message,
            'status' => $this->status,
            'created_at' => $this->created_at?->toIso8601String(),
        ];

        if (! $request->user()?->can('viewDetail', $this->resource)) {
            return $reduced;
        }

        return $reduced + [
            'title' => $this->title,
            'type' => $this->type,
            'risk_prediction_id' => $this->risk_prediction_id,
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student->id,
                'name' => trim($this->student->first_name.' '.$this->student->last_name),
            ]),
            'interventions' => InterventionResource::collection($this->whenLoaded('interventions')),
        ];
    }
}
