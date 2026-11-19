<?php

namespace App\Services;

use App\Models\TutorMessage;
use App\Models\TutorSession;

/**
 * Utilidades de contenido del tutor socrático: fases C.R.E.A.T.E.,
 * intenciones del mensaje y normalización de borradores de artículo.
 */
final class SocraticTutorContent
{
    public static function isArticleIntent(?string $intent): bool
    {
        return is_string($intent) && str_starts_with($intent, 'article_');
    }

    public static function detectIntent(?string $message, ?string $optionId): ?string
    {
        $raw = strtoupper(trim($message ?? $optionId ?? ''));

        if ($raw === '') {
            return null;
        }

        $exactIntent = match ($raw) {
            'HINT' => 'hint',
            'DIAGRAM' => 'diagram',
            'QUIZ' => 'quiz',
            default => null,
        };

        if ($exactIntent !== null) {
            return $exactIntent;
        }

        $prefixIntents = [
            '[HINT]' => 'hint',
            '[PISTA]' => 'hint',
            '[DIAGRAM' => 'diagram',
            '[QUIZ]' => 'quiz',
            '[ARTICLE_PUBLISH]' => 'article_publish',
            '[ARTICLE_PROOFREAD]' => 'article_proofread',
            '[ARTICLE_SYNTH]' => 'article_synth',
            '[ARTICLE_CITE]' => 'article_cite',
            '[ARTICLE_COWRITE]' => 'article_cowrite',
            '[ARTICLE]' => 'article_cowrite',
        ];

        $intent = null;

        foreach ($prefixIntents as $prefix => $candidate) {
            if (str_starts_with($raw, $prefix)) {
                $intent = $candidate;

                break;
            }
        }

        return $intent;
    }

    public static function studentContent(TutorSession $session, ?string $message, ?string $optionId, string $topic): string
    {
        if (filled($message)) {
            return match (true) {
                str_starts_with(strtoupper($message), '[HINT]') => 'Pedir pista',
                str_starts_with(strtoupper($message), '[PISTA]') => 'Pedir pista',
                str_starts_with(strtoupper($message), '[DIAGRAM') => 'Ver diagrama',
                str_starts_with(strtoupper($message), '[QUIZ]') => 'Autoevaluación',
                str_starts_with(strtoupper($message), '[ARTICLE_PUBLISH]') => 'Publicar artículo',
                str_starts_with(strtoupper($message), '[ARTICLE_PROOFREAD]') => 'Revisar ortografía',
                str_starts_with(strtoupper($message), '[ARTICLE_SYNTH]') => 'Sintetizar artículo',
                str_starts_with(strtoupper($message), '[ARTICLE_CITE]') => 'Citar fuentes',
                str_starts_with(strtoupper($message), '[ARTICLE_COWRITE]') => 'Co-escribir artículo',
                str_starts_with(strtoupper($message), '[ARTICLE]') => 'Redactar artículo',
                default => $message,
            };
        }

        return self::optionText($session, $optionId) ?? $topic;
    }

    public static function phaseFromStep(?string $step): ?string
    {
        return match ($step) {
            'diagnostico' => 'conectar',
            'pregunta_guia' => 'recordar',
            'pista' => 'explicar',
            'verificacion' => 'aplicar',
            'reflexion' => 'transferir',
            'finalizado' => 'evaluar',
            default => null,
        };
    }

    public static function stepFromPhase(?string $phase): string
    {
        return match ($phase) {
            'conectar' => 'diagnostico',
            'recordar' => 'pregunta_guia',
            'explicar' => 'pista',
            'aplicar' => 'verificacion',
            'transferir' => 'reflexion',
            'evaluar' => 'finalizado',
            default => 'diagnostico',
        };
    }

    /**
     * @return array{question: string, options: list<array{id: string, text: string}>}|null
     */
    public static function publicQuiz(mixed $quiz): ?array
    {
        if (! is_array($quiz) || ! is_string($quiz['question'] ?? null)) {
            return null;
        }

        $options = collect($quiz['options'] ?? [])
            ->map(fn ($option) => [
                'id' => (string) ($option['id'] ?? ''),
                'text' => (string) ($option['text'] ?? ''),
            ])
            ->filter(fn ($option) => $option['id'] !== '' && $option['text'] !== '')
            ->values()
            ->all();

        return $options === [] ? null : ['question' => $quiz['question'], 'options' => $options];
    }

    /**
     * @return array{title: string, description: string}|null
     */
    public static function publicVisual(mixed $resource): ?array
    {
        if (! is_array($resource) || ! is_string($resource['title'] ?? null) || $resource['title'] === '') {
            return null;
        }

        return [
            'title' => $resource['title'],
            'description' => (string) ($resource['description'] ?? ''),
        ];
    }

    /**
     * @return array{title: string, body: string, create_phase: ?string, published: bool, published_at: ?string}
     */
    public static function parseArticleDraft(?string $message): array
    {
        $raw = (string) preg_replace('/^\[ARTICLE_[A-Z]+\]\s*/', '', (string) $message);
        $title = '';
        $phase = null;

        if (preg_match('/^Título:\s*(.+)$/mi', $raw, $match) === 1) {
            $title = trim($match[1]);
        }

        if (preg_match('/^Fase:\s*([a-zÁÉÍÓÚáéíóú]+)/mi', $raw, $match) === 1) {
            $phase = self::normalizeCreatePhase($match[1]);
        }

        $parts = preg_split('/^---\s*$/m', $raw, 2);
        $body = isset($parts[1]) ? trim($parts[1]) : '';

        return [
            'title' => $title,
            'body' => $body,
            'create_phase' => $phase,
            'published' => false,
            'published_at' => null,
        ];
    }

    /**
     * @param  array{title: string, body: string, create_phase: ?string, published: bool, published_at: ?string}  $incoming
     * @return array{title: string, body: string, create_phase: ?string, published: bool, published_at: ?string}
     */
    public static function mergeArticleDraft(?TutorSession $session, array $incoming): array
    {
        $current = is_array($session?->state['article'] ?? null) ? $session->state['article'] : [];

        return [
            'title' => $incoming['title'] !== '' ? $incoming['title'] : (string) ($current['title'] ?? ''),
            'body' => $incoming['body'] !== '' ? $incoming['body'] : (string) ($current['body'] ?? ''),
            'create_phase' => $incoming['create_phase'] ?? (is_string($current['create_phase'] ?? null) ? $current['create_phase'] : null),
            'published' => (bool) ($current['published'] ?? false),
            'published_at' => is_string($current['published_at'] ?? null) ? $current['published_at'] : null,
        ];
    }

    public static function normalizeCreatePhase(string $phase): ?string
    {
        $key = strtolower(trim($phase));

        return in_array($key, ['conectar', 'recordar', 'explicar', 'aplicar', 'transferir', 'evaluar'], true)
            ? $key
            : null;
    }

    public static function optionText(?TutorSession $session, ?string $optionId): ?string
    {
        if ($optionId === null || $session === null || ! $session->exists) {
            return null;
        }

        $last = $session->messages->last(
            fn (TutorMessage $message) => $message->role === TutorMessage::ROLE_TUTOR
        ) ?? $session->messages()->where('role', TutorMessage::ROLE_TUTOR)->latest('id')->first();
        $options = $last?->meta['options'] ?? $last?->meta['quiz']['options'] ?? [];

        return collect($options)->firstWhere('id', $optionId)['text'] ?? $optionId;
    }
}
