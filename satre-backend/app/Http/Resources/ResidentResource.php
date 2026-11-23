<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ResidentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'student_code' => $this->student_code,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => trim($this->first_name.' '.$this->last_name),
            'classroom' => $this->whenLoaded('classroom', fn () => $this->classroom
                ? ['id' => $this->classroom->id, 'name' => $this->classroom->name]
                : null),
            'presence' => $this->whenLoaded('residentialPresences', function () {
                $presence = $this->residentialPresences->first();

                return $presence ? ['id' => $presence->id, 'status' => $presence->status, 'notes' => $presence->notes] : null;
            }),
        ];
    }
}
