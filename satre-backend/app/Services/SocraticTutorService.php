<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Student;
use App\Models\TutorMessage;
use App\Models\TutorSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Turno del tutor socrático (§4.6, §5.5). La máquina de estados vive en satre-analytics;
 * aquí solo se persiste la conversación. Si Python no responde no se guarda nada.
 */
class SocraticTutorService
{
    public function __construct(
        private readonly AnalyticsClient $client,
    ) {}

    /**
     * @param  array{topic?: ?string, message?: ?string, option_id?: ?string}  $data
     * @return array{available: bool, data: ?array{session: TutorSession, reply: array, done: bool}}
     */
    public function turn(Student $student, Course $course, ?TutorSession $session, array $data): array
    {
        if ($session !== null && $session->status !== TutorSession::STATUS_ACTIVE) {
            throw ValidationException::withMessages(['session_id' => 'Esta sesión ya terminó. Inicia una nueva.']);
        }

        $topic = $session?->topic ?? (string) $data['topic'];
        $message = filled($data['message'] ?? null) ? trim($data['message']) : null;
        $optionId = $data['option_id'] ?? null;

        $result = $this->client->socraticNext([
            'topic' => $topic,
            'course_id' => $course->id,
            'message' => $message,
            'option_id' => $optionId,
            'state' => $session?->state,
        ]);

        if (! $result['available'] || ! is_string($result['reply']['text'] ?? null)) {
            return ['available' => false, 'data' => null];
        }

        return DB::transaction(function () use ($student, $course, $session, $topic, $message, $optionId, $result) {
            $session ??= TutorSession::query()->create([
                'student_id' => $student->id,
                'course_id' => $course->id,
                'topic' => $topic,
                'status' => TutorSession::STATUS_ACTIVE,
            ]);

            $session->messages()->create([
                'role' => TutorMessage::ROLE_STUDENT,
                'content' => $message ?? $this->optionText($session, $optionId) ?? $topic,
                'meta' => $optionId ? ['option_id' => $optionId] : null,
            ]);

            $reply = $result['reply'];
            $done = (bool) ($result['done'] ?? false);
            $scaffoldId = $result['meta']['scaffold_id'] ?? null;

            $session->messages()->create([
                'role' => TutorMessage::ROLE_TUTOR,
                'content' => $reply['text'],
                'meta' => [
                    'type' => $reply['type'] ?? null,
                    'options' => $reply['options'] ?? [],
                    'step' => $result['step'] ?? null,
                    'hint_level' => $result['hint_level'] ?? 0,
                    'scaffold_id' => $scaffoldId,
                ],
            ]);

            $session->update([
                'state' => $result['state'] ?? null,
                'criterion' => $result['meta']['criterion'] ?? $session->criterion,
                'status' => match (true) {
                    ! $done => TutorSession::STATUS_ACTIVE,
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

    private function optionText(TutorSession $session, ?string $optionId): ?string
    {
        if ($optionId === null || ! $session->exists) {
            return null;
        }

        $options = $session->messages()->where('role', TutorMessage::ROLE_TUTOR)->latest('id')->first()?->meta['options'] ?? [];

        return collect($options)->firstWhere('id', $optionId)['text'] ?? $optionId;
    }
}
