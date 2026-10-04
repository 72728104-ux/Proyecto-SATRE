<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TutorMessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'role' => $this->role,
            'content' => $this->content,
            'type' => $this->meta['type'] ?? null,
            'options' => $this->meta['options'] ?? [],
            'create_phase' => $this->meta['create_phase'] ?? null,
            'explanation' => $this->meta['explanation'] ?? null,
            'reflection' => $this->meta['reflection'] ?? null,
            'quiz' => $this->meta['quiz'] ?? null,
            'diagram_mermaid' => $this->meta['diagram_mermaid'] ?? null,
            'visual_resource' => $this->meta['visual_resource'] ?? null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
