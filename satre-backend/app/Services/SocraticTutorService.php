<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Student;
use App\Models\TutorMessage;
use App\Models\TutorSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Turno del tutor socrático (§4.6 / TOBE-3). Solo Gemini vía
 * /api/v1/analytics/socratic-tutor. Si satre-analytics o Gemini fallan se
 * reporta el error real; no hay fallback al catálogo estático.
 */
class SocraticTutorService
{
    public function __construct(
        private readonly PythonAnalyticsClient $client,
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

        $result = $this->tryHybrid($student, $session, $topic, $criterion, $message, $optionId, $intent);

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
        $hybrid = $this->client->socraticHybrid([
            'student_id' => $student->id,
            'user_message' => $userMessage,
            'history' => $this->hybridHistory($session),
            'topic' => $topic,
            'create_phase' => $session?->state['create_phase'] ?? $this->phaseFromStep($session?->state['step'] ?? null),
            'intent' => $intent,
            'criterion' => $criterion,
        ]);

        $response = $hybrid['socratic_response'] ?? null;
        $reason = is_array($response)
            ? ($response['reason'] ?? $hybrid['reason'] ?? null)
            : ($hybrid['reason'] ?? null);
        $errorMessage = is_array($response)
            ? ($response['message'] ?? $hybrid['message'] ?? null)
            : ($hybrid['message'] ?? null);

        if (! ($hybrid['available'] ?? false)) {
            return [
                'reason' => $reason ?? 'analytics_unavailable',
                'message' => $errorMessage ?? 'satre-analytics no está disponible.',
            ];
        }

        if (! is_array($response) || ! ($response['available'] ?? false)) {
            return [
                'reason' => $reason ?? 'gemini_unavailable',
                'message' => $errorMessage ?? 'Gemini no devolvió una guía socrática.',
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
            'diagram_mermaid' => $reply['diagram_mermaid'] ?? null,
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
