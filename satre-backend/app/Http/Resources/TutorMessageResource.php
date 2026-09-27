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
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
