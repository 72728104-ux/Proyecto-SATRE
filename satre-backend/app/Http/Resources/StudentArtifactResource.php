<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentArtifactResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reading_material_id' => $this->reading_material_id,
            'student_id' => $this->student_id,
            'student_name' => $this->whenLoaded('student', fn () => trim($this->student->first_name.' '.$this->student->last_name)),
            'nodes' => $this->nodes,
            'connections' => $this->connections,
        ];
    }
}
