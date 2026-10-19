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
            'create_phase' => $this->state['create_phase'] ?? match ($this->state['step'] ?? null) {
                'diagnostico' => 'conectar',
                'pregunta_guia' => 'recordar',
                'pista' => 'explicar',
                'verificacion' => 'aplicar',
                'reflexion' => 'transferir',
                'finalizado' => 'evaluar',
                default => null,
            },
            'hint_level' => (int) ($this->state['hint_level'] ?? 0),
            'article' => $this->publicArticle(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'messages' => TutorMessageResource::collection($this->whenLoaded('messages')),
        ];
    }

    /**
     * @return array{title: string, body: string, create_phase: ?string, published: bool, published_at: ?string}|null
     */
    private function publicArticle(): ?array
    {
        $article = $this->state['article'] ?? null;
        if (! is_array($article) || ! is_string($article['title'] ?? null)) {
            return null;
        }

        return [
            'title' => $article['title'],
            'body' => (string) ($article['body'] ?? ''),
            'create_phase' => is_string($article['create_phase'] ?? null) ? $article['create_phase'] : null,
            'published' => (bool) ($article['published'] ?? false),
            'published_at' => is_string($article['published_at'] ?? null) ? $article['published_at'] : null,
        ];
    }
}
