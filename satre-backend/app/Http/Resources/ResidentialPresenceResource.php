<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ResidentialPresenceResource extends JsonResource
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
            'presence_date' => $this->presence_date?->toDateString(),
            'check_type' => $this->check_type,
            'status' => $this->status,
            'notes' => $this->notes,
            'recorded_by' => $this->recorded_by,
        ];
    }
}
