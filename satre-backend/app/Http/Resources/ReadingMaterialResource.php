<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReadingMaterialResource extends JsonResource
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
            'title' => $this->title,
            'criterion' => $this->criterion,
            'content' => $this->content,
            'url' => $this->url,
            'created_by' => $this->created_by,
        ];
    }
}
