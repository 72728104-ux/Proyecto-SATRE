<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * No expone `state`: es interno de satre-analytics.
 */
class TutorSessionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'course_id' => $this->course_id,
            'course_name' => $this->whenLoaded('course', fn () => $this->course?->name),
            'topic' => $this->topic,
            'criterion' => $this->criterion,
            'status' => $this->status,
            'step' => $this->state['step'] ?? 'finalizado',
            'hint_level' => (int) ($this->state['hint_level'] ?? 0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'messages' => TutorMessageResource::collection($this->whenLoaded('messages')),
        ];
    }
}
