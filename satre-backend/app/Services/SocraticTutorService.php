<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Student;
use App\Models\TutorMessage;
use App\Models\TutorSession;
use App\Support\MermaidSyntax;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Turno del tutor socrático (§4.6 / TOBE-3). Solo Gemini vía
 * /api/v1/analytics/socratic-tutor. Si el proveedor de IA falla (401/429/5xx,
 * timeout o key inválida) se registra el error exacto y se persiste un turno
 * de cortesía; no se usa el catálogo estático /v1/socratic/next.
 */
class SocraticTutorService
{
    public function __construct(
        private readonly PythonAnalyticsClient $client,
        private readonly GeminiClient $gemini,
    ) {}

    /**
     * @param  array{topic?: ?string, criterion?: ?string, message?: ?string, option_id?: ?string}  $data
     * @return array{available: bool, data: ?array{session: TutorSession, reply: array, done: bool}}
     */
    public function turn(Student $student, Course $course, ?TutorSession $session, array $data): array
    {
        if ($session !== null && $session->status !== TutorSession::STATUS_ACTIVE) {
            throw ValidationException::withMessages(['session_id' => 'Esta sesión ya terminó. Inicia una nueva.']);
        }

        $session?->loadMissing('messages');

        $topic = $session?->topic ?? (string) $data['topic'];
        $criterion = $session?->criterion ?? ($data['criterion'] ?? null);
        $message = filled($data['message'] ?? null) ? trim($data['message']) : null;
        $optionId = $data['option_id'] ?? null;
        $intent = $this->detectIntent($message, $optionId);

        $result = $this->isArticleIntent($intent)
            ? $this->tryArticle($student, $session, $topic, $criterion, $message, $intent)
            : $this->tryHybrid($student, $session, $topic, $criterion, $message, $optionId, $intent);

        if (! is_string($result['reply']['text'] ?? null)) {
            return [
                'available' => false,
                'data' => null,
                'reason' => $result['reason'] ?? 'gemini_unavailable',
                'message' => $result['message'] ?? 'El tutor de IA no pudo completar este turno.',
            ];
        }

        return DB::transaction(function () use ($student, $course, $session, $topic, $criterion, $message, $optionId, $intent, $result) {
            $session ??= TutorSession::query()->create([
                'student_id' => $student->id,
                'course_id' => $course->id,
                'topic' => $topic,
                'criterion' => $criterion,
                'status' => TutorSession::STATUS_ACTIVE,
            ]);

            $session->messages()->create([
                'role' => TutorMessage::ROLE_STUDENT,
                'content' => $this->studentContent($session, $message, $optionId, $topic),
                'meta' => array_filter([
                    'option_id' => $optionId,
                    'intent' => $intent,
                ]),
            ]);

            $reply = $this->publicReply($result['reply'] ?? []);
            $done = (bool) ($result['done'] ?? false);
            $scaffoldId = $result['meta']['scaffold_id'] ?? null;
            $engine = $result['engine'] ?? 'catalog';

            $session->messages()->create([
                'role' => TutorMessage::ROLE_TUTOR,
                'content' => $reply['text'],
                'meta' => [
                    'type' => $reply['type'] ?? null,
                    'options' => $reply['options'] ?? [],
                    'step' => $result['step'] ?? null,
                    'hint_level' => $result['hint_level'] ?? 0,
                    'scaffold_id' => $scaffoldId,
                    'create_phase' => $reply['create_phase'] ?? null,
                    'explanation' => $reply['explanation'] ?? null,
                    'reflection' => $reply['reflection'] ?? null,
                    'quiz' => $reply['quiz'] ?? null,
                    'diagram_mermaid' => $reply['diagram_mermaid'] ?? null,
                    'visual_resource' => $reply['visual_resource'] ?? null,
                    'engine' => $engine,
                ],
            ]);

            $state = $result['state'] ?? null;
            if (is_array($state) && isset($reply['create_phase'])) {
                $state['create_phase'] = $reply['create_phase'];
            }
            if (is_array($result['article'] ?? null)) {
                $state = is_array($state) ? $state : [];
                $state['article'] = $result['article'];
            }

            $session->update([
                'state' => $state,
                'criterion' => $session->criterion ?? $result['meta']['criterion'] ?? null,
                'status' => match (true) {
                    ! $done => TutorSession::STATUS_ACTIVE,
                    $engine === 'hybrid' => TutorSession::STATUS_COMPLETED,
                    $scaffoldId === null => TutorSession::STATUS_NO_CATALOG,
                    default => TutorSession::STATUS_COMPLETED,
                },
            ]);

            return [
                'available' => true,
                'data' => ['session' => $session->load('course:id,name'), 'reply' => $reply, 'done' => $done],
            ];
        });
    }

    /**
     * Borra historial y borrador de artículo del estudiante.
     * No toca predicciones de riesgo ni diagnósticos agregados de analítica.
     */
    public function delete(TutorSession $session): void
    {
        DB::transaction(function () use ($session): void {
            $session->messages()->delete();
            $session->delete();
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function tryHybrid(
        Student $student,
        ?TutorSession $session,
        string $topic,
        ?string $criterion,
        ?string $message,
        ?string $optionId,
        ?string $intent,
    ): array {
        $userMessage = $message ?? $this->optionText($session, $optionId) ?? $topic;
        $phaseHint = $session?->state['create_phase'] ?? $this->phaseFromStep($session?->state['step'] ?? null);

        try {
            $hybrid = $this->client->socraticHybrid([
                'student_id' => $student->id,
                'user_message' => $userMessage,
                'history' => $this->hybridHistory($session),
                'topic' => $topic,
                'create_phase' => $phaseHint,
                'intent' => $intent,
                'criterion' => $criterion,
            ]);
        } catch (Throwable $e) {
            Log::warning('socratic tutor: excepción al llamar satre-analytics', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return $this->geminiOrCourtesy(
                $topic,
                $phaseHint,
                $userMessage,
                class_basename($e),
                $session,
                $intent,
            );
        }

        $response = $hybrid['socratic_response'] ?? null;
        $reason = is_array($response)
            ? ($response['reason'] ?? $hybrid['reason'] ?? null)
            : ($hybrid['reason'] ?? null);
        $errorMessage = is_array($response)
            ? ($response['message'] ?? $hybrid['message'] ?? null)
            : ($hybrid['message'] ?? null);
        $httpStatus = is_array($response)
            ? ($response['http_status'] ?? $hybrid['status'] ?? null)
            : ($hybrid['status'] ?? null);

        if (! ($hybrid['available'] ?? false) || ! is_array($response) || ! ($response['available'] ?? false)) {
            $this->logProviderFailure($hybrid, is_array($response) ? $response : null, $reason, $errorMessage, $httpStatus);

            if ($this->shouldUseCourtesyFallback($reason, $httpStatus)) {
                return $this->geminiOrCourtesy(
                    $topic,
                    $hybrid['create_phase'] ?? $phaseHint,
                    $userMessage,
                    $reason ?? 'gemini_unavailable',
                    $session,
                    $intent,
                );
            }

            return [
                'reason' => $reason ?? 'gemini_unavailable',
                'message' => $errorMessage ?? 'El tutor de IA no pudo completar este turno.',
            ];
        }

        $phase = $hybrid['create_phase'] ?? $response['create_phase'] ?? 'conectar';
        $reply = is_array($hybrid['reply'] ?? null)
            ? $hybrid['reply']
            : ['type' => 'question', 'text' => $response['guidance'] ?? $response['explanation'] ?? ''];
        $previous = $session?->state['create_phase'] ?? null;
        $done = (bool) ($hybrid['done'] ?? $response['done'] ?? false)
            || ($previous === 'evaluar' && $intent === null);

        $hintLevel = (int) ($session?->state['hint_level'] ?? 0);
        if ($intent === 'hint') {
            $hintLevel = min($hintLevel + 1, 3);
        }

        return [
            'engine' => 'hybrid',
            'reply' => $this->publicReply($reply + [
                'create_phase' => $phase,
                'explanation' => $reply['explanation'] ?? $response['explanation'] ?? null,
                'reflection' => $reply['reflection'] ?? $response['reflection'] ?? null,
                'quiz' => $reply['quiz'] ?? $response['quiz'] ?? null,
                'diagram_mermaid' => $reply['diagram_mermaid'] ?? $response['diagram_mermaid'] ?? null,
                'visual_resource' => $reply['visual_resource'] ?? $response['visual_resource'] ?? null,
            ]),
            'done' => $done,
            'step' => $this->stepFromPhase($phase),
            'hint_level' => $hintLevel,
            'state' => [
                'version' => 2,
                'engine' => 'hybrid',
                'create_phase' => $phase,
                'step' => $this->stepFromPhase($phase),
                'hint_level' => $hintLevel,
                'turns' => (int) ($session?->state['turns'] ?? 0) + 1,
            ],
            'meta' => [
                'scaffold_id' => 'hybrid-create',
                'criterion' => $criterion,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $hybrid
     * @param  array<string, mixed>|null  $response
     */
    private function logProviderFailure(array $hybrid, ?array $response, ?string $reason, ?string $message, mixed $httpStatus): void
    {
        Log::warning('socratic tutor: fallo del proveedor de IA', [
            'reason' => $reason,
            'message' => $message,
            'http_status' => is_numeric($httpStatus) ? (int) $httpStatus : $httpStatus,
            'provider_status' => $response['provider_status'] ?? $hybrid['provider_status'] ?? null,
            'provider_error' => $response['provider_error'] ?? $hybrid['provider_error'] ?? null,
            'endpoint' => '/api/v1/analytics/socratic-tutor',
        ]);
    }

    private function shouldUseCourtesyFallback(?string $reason, mixed $httpStatus): bool
    {
        if (in_array($reason, [
            'analytics_unavailable',
            'gemini_unavailable',
            'quota_exhausted',
            'api_unavailable',
            'timeout',
            'not_configured',
            'api_error',
            'auth_error',
            'http_error',
            'internal_error',
            'invalid_response',
            'safety_blocked',
            'ConnectionException',
        ], true)) {
            return true;
        }

        return in_array((int) $httpStatus, [401, 403, 408, 429, 500, 502, 503, 504], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function courtesyFallback(
        string $topic,
        ?string $phase,
        string $reason,
        ?TutorSession $session,
        ?string $intent,
    ): array {
        $createPhase = $phase ?: 'conectar';
        $hintLevel = (int) ($session?->state['hint_level'] ?? 0);
        if ($intent === 'hint') {
            $hintLevel = min($hintLevel + 1, 3);
        }

        return [
            'engine' => 'fallback',
            'reply' => $this->courtesyReply($topic, $createPhase),
            'done' => false,
            'step' => $this->stepFromPhase($createPhase),
            'hint_level' => $hintLevel,
            'state' => [
                'version' => 2,
                'engine' => 'fallback',
                'create_phase' => $createPhase,
                'step' => $this->stepFromPhase($createPhase),
                'hint_level' => $hintLevel,
                'turns' => (int) ($session?->state['turns'] ?? 0) + 1,
                'fallback_reason' => $reason,
            ],
            'meta' => [
                'scaffold_id' => 'hybrid-create',
                'criterion' => $session?->criterion,
                'fallback' => true,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function courtesyReply(string $topic, string $phase): array
    {
        $safeTopic = trim($topic) !== '' ? trim($topic) : 'este tema';
        $text = "Ahora no pude consultar al tutor de IA. Mientras se restablece, cuéntame con tus palabras qué recuerdas de «{$safeTopic}». ¿Qué parte te resulta más confusa?";

        return [
            'type' => 'question',
            'text' => $text,
            'create_phase' => $phase,
            'explanation' => $text,
            'reflection' => 'Escribe un ejemplo con tus propias palabras; no hace falta que sea perfecto.',
        ];
    }

    /**
     * @param  array<string, mixed>  $reply
     * @return array<string, mixed>
     */
    private function publicReply(array $reply): array
    {
        $quiz = $this->publicQuiz($reply['quiz'] ?? null);
        $options = $reply['options'] ?? ($quiz['options'] ?? []);
        $text = (string) ($reply['text'] ?? '');

        $public = [
            'type' => $reply['type'] ?? 'question',
            'text' => $text,
            'create_phase' => is_string($reply['create_phase'] ?? null)
                ? $reply['create_phase']
                : 'conectar',
            'explanation' => $reply['explanation'] ?? $text,
            'reflection' => $reply['reflection'] ?? null,
            'quiz' => $quiz,
            'diagram_mermaid' => MermaidSyntax::sanitize(
                is_string($reply['diagram_mermaid'] ?? null) ? $reply['diagram_mermaid'] : null,
            ),
            'visual_resource' => $this->publicVisual($reply['visual_resource'] ?? null),
        ];
        if ($options) {
            $public['options'] = collect($options)
                ->map(fn ($option) => [
                    'id' => (string) ($option['id'] ?? ''),
                    'text' => (string) ($option['text'] ?? ''),
                ])
                ->filter(fn ($option) => $option['id'] !== '' && $option['text'] !== '')
                ->values()
                ->all();
        }

        return $public;
    }

    /**
     * @return list<array{role: string, content: string}>
     */
    private function hybridHistory(?TutorSession $session): array
    {
        if ($session === null) {
            return [];
        }

        return $session->messages
            ->map(fn (TutorMessage $message) => [
                'role' => $message->role,
                'content' => $message->content,
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function geminiOrCourtesy(
        string $topic,
        ?string $phase,
        string $userMessage,
        string $reason,
        ?TutorSession $session,
        ?string $intent,
    ): array {
        $createPhase = $phase ?: 'conectar';
        $direct = $this->gemini->generate(
            $this->socraticPrompt($topic, $createPhase, $userMessage, $intent),
            $this->socraticSystemInstruction(),
        );

        if ($direct['available'] ?? false) {
            return $this->directGeminiResult($topic, $createPhase, (string) $direct['text'], $session, $intent);
        }

        return $this->courtesyFallback($topic, $createPhase, $reason, $session, $intent);
    }

    /**
     * @return array<string, mixed>
     */
    private function tryArticle(
        Student $student,
        ?TutorSession $session,
        string $topic,
        ?string $criterion,
        ?string $message,
        string $intent,
    ): array {
        $draft = $this->mergeArticleDraft($session, $this->parseArticleDraft($message));
        $phase = $draft['create_phase'] ?? $session?->state['create_phase'] ?? 'conectar';

        if ($intent === 'article_publish') {
            $article = array_merge($draft, [
                'published' => true,
                'published_at' => now()->toIso8601String(),
            ]);
            $title = $article['title'] !== '' ? $article['title'] : $topic;
            $text = "Artículo «{$title}» publicado. Puedes seguir editándolo en el panel o usarlo como evidencia C.R.E.A.T.E.";

            return $this->articleResult($text, $phase, $article, $session, $intent, 'publish');
        }

        $direct = $this->gemini->generate(
            $this->articlePrompt($intent, $topic, $draft),
            $this->articleSystemInstruction($intent),
        );
        if ($direct['available'] ?? false) {
            return $this->articleResult((string) $direct['text'], $phase, $draft, $session, $intent, 'gemini');
        }

        $hybrid = $this->tryHybrid($student, $session, $topic, $criterion, $message, null, $intent);
        if (is_string($hybrid['reply']['text'] ?? null)) {
            $hybrid['article'] = $draft;
            $hybrid['reply']['type'] = 'article';

            return $hybrid;
        }

        $text = 'No pude consultar a la IA ahora. Sigue el paso C.R.E.A.T.E. indicado y escribe un párrafo con tus palabras; luego reintenta la asistencia.';

        return $this->articleResult($text, $phase, $draft, $session, $intent, 'fallback');
    }

    /**
     * @param  array<string, mixed>  $article
     * @return array<string, mixed>
     */
    private function articleResult(
        string $text,
        string $phase,
        array $article,
        ?TutorSession $session,
        string $intent,
        string $engine,
    ): array {
        $hintLevel = (int) ($session?->state['hint_level'] ?? 0);

        return [
            'engine' => $engine,
            'article' => $article,
            'reply' => $this->publicReply([
                'type' => 'article',
                'text' => $text,
                'create_phase' => $phase,
                'explanation' => $text,
                'reflection' => 'Revisa la sugerencia, edítala con tu voz y avanza a la siguiente fase C.R.E.A.T.E.',
            ]),
            'done' => false,
            'step' => $this->stepFromPhase($phase),
            'hint_level' => $hintLevel,
            'state' => [
                'version' => 2,
                'engine' => $engine,
                'create_phase' => $phase,
                'step' => $this->stepFromPhase($phase),
                'hint_level' => $hintLevel,
                'turns' => (int) ($session?->state['turns'] ?? 0) + 1,
                'article' => $article,
                'article_intent' => $intent,
            ],
            'meta' => [
                'scaffold_id' => 'hybrid-create',
                'criterion' => $session?->criterion,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function directGeminiResult(
        string $topic,
        string $phase,
        string $text,
        ?TutorSession $session,
        ?string $intent,
    ): array {
        $hintLevel = (int) ($session?->state['hint_level'] ?? 0);
        if ($intent === 'hint') {
            $hintLevel = min($hintLevel + 1, 3);
        }

        return [
            'engine' => 'gemini',
            'reply' => $this->publicReply([
                'type' => 'question',
                'text' => $text,
                'create_phase' => $phase,
                'explanation' => $text,
                'reflection' => 'Responde con tus palabras; el tutor no debe darte la solución final.',
            ]),
            'done' => false,
            'step' => $this->stepFromPhase($phase),
            'hint_level' => $hintLevel,
            'state' => [
                'version' => 2,
                'engine' => 'gemini',
                'create_phase' => $phase,
                'step' => $this->stepFromPhase($phase),
                'hint_level' => $hintLevel,
                'turns' => (int) ($session?->state['turns'] ?? 0) + 1,
                'topic' => $topic,
            ],
            'meta' => [
                'scaffold_id' => 'hybrid-create',
                'criterion' => $session?->criterion,
            ],
        ];
    }

    private function socraticSystemInstruction(): string
    {
        return 'Eres el tutor socrático SATRE. Guía con la metodología C.R.E.A.T.E. (Conectar, Recordar, Explicar, Aplicar, Transferir, Evaluar). Responde en español, con una pregunta o pista breve. Nunca des la respuesta final ni datos personales.';
    }

    private function socraticPrompt(string $topic, string $phase, string $userMessage, ?string $intent): string
    {
        return implode("\n", [
            "Tema: {$topic}",
            "Fase C.R.E.A.T.E.: {$phase}",
            'Intención: '.($intent ?? 'turno libre'),
            "Mensaje del estudiante: {$userMessage}",
        ]);
    }

    private function articleSystemInstruction(string $intent): string
    {
        $task = match ($intent) {
            'article_proofread' => 'Corrige ortografía, tildes y claridad. Conserva la voz del estudiante. Devuelve solo el texto revisado.',
            'article_synth' => 'Sintetiza el borrador en un párrafo denso y fiel. Devuelve solo la síntesis.',
            'article_cite' => 'Propón citas académicas (autor, año, título) alineadas al borrador. No inventes DOI. Devuelve solo la lista.',
            default => 'Co-escribe el siguiente párrafo según la fase C.R.E.A.T.E. No reescribas todo el artículo. Devuelve solo el párrafo propuesto.',
        };

        return 'Eres un editor académico SATRE para estudiantes COAR. '.$task.' Responde en español. No pidas datos personales.';
    }

    /**
     * @param  array{title: string, body: string, create_phase: ?string, published: bool, published_at: ?string}  $draft
     */
    private function articlePrompt(string $intent, string $topic, array $draft): string
    {
        return implode("\n", [
            "Tema: {$topic}",
            'Fase C.R.E.A.T.E.: '.($draft['create_phase'] ?? 'conectar'),
            'Acción: '.$intent,
            'Título: '.($draft['title'] !== '' ? $draft['title'] : $topic),
            'Borrador:',
            $draft['body'] !== '' ? $draft['body'] : '(vacío: propone un inicio)',
        ]);
    }

    /**
     * @return array{title: string, body: string, create_phase: ?string, published: bool, published_at: ?string}
     */
    private function parseArticleDraft(?string $message): array
    {
        $raw = (string) preg_replace('/^\[ARTICLE_[A-Z]+\]\s*/', '', (string) $message);
        $title = '';
        $phase = null;
        if (preg_match('/^Título:\s*(.+)$/mi', $raw, $match) === 1) {
            $title = trim($match[1]);
        }
        if (preg_match('/^Fase:\s*([a-zÁÉÍÓÚáéíóú]+)/mi', $raw, $match) === 1) {
            $phase = $this->normalizeCreatePhase($match[1]);
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
    private function mergeArticleDraft(?TutorSession $session, array $incoming): array
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

    private function normalizeCreatePhase(string $phase): ?string
    {
        $key = strtolower(trim($phase));

        return in_array($key, ['conectar', 'recordar', 'explicar', 'aplicar', 'transferir', 'evaluar'], true)
            ? $key
            : null;
    }

    private function isArticleIntent(?string $intent): bool
    {
        return is_string($intent) && str_starts_with($intent, 'article_');
    }

    private function detectIntent(?string $message, ?string $optionId): ?string
    {
        $raw = strtoupper(trim($message ?? $optionId ?? ''));
        if ($raw === '') {
            return null;
        }
        if (str_starts_with($raw, '[HINT]') || str_starts_with($raw, '[PISTA]') || $raw === 'HINT') {
            return 'hint';
        }
        if (str_starts_with($raw, '[DIAGRAM') || $raw === 'DIAGRAM') {
            return 'diagram';
        }
        if (str_starts_with($raw, '[QUIZ]') || $raw === 'QUIZ') {
            return 'quiz';
        }
        if (str_starts_with($raw, '[ARTICLE_PUBLISH]')) {
            return 'article_publish';
        }
        if (str_starts_with($raw, '[ARTICLE_PROOFREAD]')) {
            return 'article_proofread';
        }
        if (str_starts_with($raw, '[ARTICLE_SYNTH]')) {
            return 'article_synth';
        }
        if (str_starts_with($raw, '[ARTICLE_CITE]')) {
            return 'article_cite';
        }
        if (str_starts_with($raw, '[ARTICLE_COWRITE]') || str_starts_with($raw, '[ARTICLE]')) {
            return 'article_cowrite';
        }

        return null;
    }

    private function studentContent(TutorSession $session, ?string $message, ?string $optionId, string $topic): string
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

        return $this->optionText($session, $optionId) ?? $topic;
    }

    private function phaseFromStep(?string $step): ?string
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

    private function stepFromPhase(?string $phase): string
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
    private function publicQuiz(mixed $quiz): ?array
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
    private function publicVisual(mixed $resource): ?array
    {
        if (! is_array($resource) || ! is_string($resource['title'] ?? null) || $resource['title'] === '') {
            return null;
        }

        return [
            'title' => $resource['title'],
            'description' => (string) ($resource['description'] ?? ''),
        ];
    }

    private function optionText(?TutorSession $session, ?string $optionId): ?string
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
