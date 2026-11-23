<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\Student;
use App\Support\MineduScale;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Asistente pedagógico TOBE-5. Primero satre-analytics
 * /api/v1/analytics/teacher-assistant; si falla, Gemini 1.5-flash
 * con Http::retry(3, 1000) vía GeminiClient.
 */
class TeacherAssistantService
{
    public function __construct(
        private readonly PythonAnalyticsClient $client,
        private readonly GeminiClient $gemini,
        private readonly AnalyticsService $analytics,
    ) {}

    /**
     * @param  array{message: string, history?: list<array{role: string, content: string}>, criterion?: ?string}  $data
     * @return array{available: bool, data: ?array{reply: array, metrics: array, engine: string}}
     */
    public function ask(Classroom $classroom, ?Student $student, array $data): array
    {
        $message = trim((string) $data['message']);
        $history = is_array($data['history'] ?? null) ? $data['history'] : [];
        $criterion = isset($data['criterion']) ? strtoupper((string) $data['criterion']) : null;

        try {
            $hybrid = $this->client->teacherAssistant([
                'classroom_id' => $classroom->id,
                'student_id' => $student?->id,
                'user_message' => $message,
                'history' => $history,
                'criterion' => $criterion,
            ]);
        } catch (Throwable $e) {
            Log::warning('teacher assistant: excepción al llamar satre-analytics', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return $this->geminiFallback($classroom, $student, $message, $history, $criterion, class_basename($e));
        }

        $response = is_array($hybrid['assistant_response'] ?? null) ? $hybrid['assistant_response'] : null;
        if ($this->usableReply($response)) {
            return [
                'available' => true,
                'data' => [
                    'reply' => $this->publicReply($response, $criterion),
                    'metrics' => is_array($hybrid['deterministic_metrics'] ?? null)
                        ? $hybrid['deterministic_metrics']
                        : $this->localMetrics($classroom, $student, $criterion),
                    'engine' => 'hybrid',
                    'insufficient_data' => (bool) ($hybrid['insufficient_data'] ?? false),
                ],
            ];
        }

        $reason = is_array($response)
            ? ($response['reason'] ?? $hybrid['reason'] ?? 'gemini_unavailable')
            : ($hybrid['reason'] ?? 'gemini_unavailable');

        return $this->geminiFallback($classroom, $student, $message, $history, $criterion, (string) $reason);
    }

    /**
     * @param  array<string, mixed>|null  $response
     */
    private function usableReply(?array $response): bool
    {
        if ($response === null || ! ($response['available'] ?? false)) {
            return false;
        }

        return filled($response['text'] ?? null) || filled($response['summary'] ?? null);
    }

    /**
     * @param  list<array{role: string, content: string}>  $history
     * @return array{available: bool, data: ?array{reply: array, metrics: array, engine: string}}
     */
    private function geminiFallback(
        Classroom $classroom,
        ?Student $student,
        string $message,
        array $history,
        ?string $criterion,
        string $reason,
    ): array {
        $direct = $this->gemini->generate(
            $this->prompt($classroom, $student, $message, $history, $criterion),
            $this->systemInstruction(),
        );

        if ($direct['available'] ?? false) {
            return [
                'available' => true,
                'data' => [
                    'reply' => $this->replyFromGeminiText((string) $direct['text'], $criterion),
                    'metrics' => $this->localMetrics($classroom, $student, $criterion),
                    'engine' => 'gemini',
                    'insufficient_data' => false,
                ],
            ];
        }

        Log::warning('teacher assistant: modelos Gemini no disponibles', [
            'reason' => $direct['reason'] ?? $reason,
            'message' => $direct['message'] ?? null,
        ]);

        return [
            'available' => false,
            'data' => null,
            'reason' => $direct['reason'] ?? $reason,
            'message' => 'El asistente docente no está disponible en este momento.',
            'status' => ($direct['status'] ?? null) === 503 ? 503 : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $response
     * @return array{text: string, summary: ?string, recommended_actions: list<string>, suggested_materials: list<string>, criterion_focus: ?string}
     */
    private function publicReply(array $response, ?string $criterion): array
    {
        $text = trim((string) ($response['text'] ?? $response['summary'] ?? ''));

        return [
            'text' => $text,
            'summary' => filled($response['summary'] ?? null) ? (string) $response['summary'] : null,
            'recommended_actions' => $this->stringList($response['recommended_actions'] ?? $response['actions'] ?? []),
            'suggested_materials' => $this->stringList($response['suggested_materials'] ?? $response['materials'] ?? []),
            'criterion_focus' => $this->criterionOf($response['criterion_focus'] ?? $criterion),
        ];
    }

    private function replyFromGeminiText(string $text, ?string $criterion): array
    {
        $parsed = json_decode($text, true);
        if (is_array($parsed) && (filled($parsed['text'] ?? null) || filled($parsed['summary'] ?? null))) {
            return $this->publicReply($parsed + ['available' => true], $criterion);
        }

        return $this->publicReply([
            'available' => true,
            'text' => trim($text),
            'summary' => null,
            'actions' => [],
            'materials' => [],
        ], $criterion);
    }

    /**
     * @return array{risk_score: mixed, risk_level: mixed, minedu_grade: mixed, passing_score: float, criteria: list<string>, top_gaps: list<array>}
     */
    private function localMetrics(Classroom $classroom, ?Student $student, ?string $criterion): array
    {
        $insights = $this->analytics->classroomInsights($classroom);
        $data = is_array($insights['data'] ?? null) ? $insights['data'] : [];
        $gaps = [];
        foreach ($data['top_gaps'] ?? [] as $gap) {
            if (! is_array($gap)) {
                continue;
            }
            if ($criterion && strtoupper((string) ($gap['criterion'] ?? '')) !== $criterion) {
                continue;
            }
            $gaps[] = [
                'criterion' => $gap['criterion'] ?? null,
                'mean_vigesimal' => $gap['mean'] ?? null,
                'pct_below_passing' => $gap['pct_below_4'] ?? null,
            ];
        }

        $prediction = $student ? $this->analytics->latestPrediction($student) : null;

        return [
            'risk_score' => $prediction?->risk_score,
            'risk_level' => $prediction?->risk_level,
            'minedu_grade' => null,
            'passing_score' => MineduScale::PASSING,
            'criteria' => ['A', 'B', 'C', 'D'],
            'top_gaps' => $gaps,
        ];
    }

    /**
     * @param  list<array{role: string, content: string}>  $history
     */
    private function prompt(
        Classroom $classroom,
        ?Student $student,
        string $message,
        array $history,
        ?string $criterion,
    ): string {
        $context = [
            'scale' => 'minedu_0_20',
            'passing_score' => MineduScale::PASSING,
            'criteria' => ['A', 'B', 'C', 'D'],
            'qualitative_letters' => MineduScale::LETTERS,
            'criterion_focus' => $criterion,
            'insights' => $this->anonymousInsights($classroom),
        ];

        if ($student !== null) {
            $prediction = $this->analytics->latestPrediction($student);
            $context['student'] = [
                'risk_level' => $prediction?->risk_level,
                'risk_score' => $prediction?->risk_score,
            ];
        }

        $turns = [];
        foreach (array_slice($history, -8) as $item) {
            if (! is_array($item)) {
                continue;
            }
            $turns[] = [
                'role' => $item['role'] ?? 'user',
                'content' => $item['content'] ?? '',
            ];
        }

        return implode("\n", [
            'Contexto académico anónimo (escala Minedu 0–20, aprobatorio ≥ 11, criterios A–D):',
            json_encode($context, JSON_UNESCAPED_UNICODE) ?: '{}',
            'Historial reciente:',
            json_encode($turns, JSON_UNESCAPED_UNICODE) ?: '[]',
            'Consulta del docente:',
            $message,
            'Devuelve un JSON con text, summary, actions (array), materials (array) y criterion_focus (A-D o null).',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function anonymousInsights(Classroom $classroom): array
    {
        $insights = $this->analytics->classroomInsights($classroom);
        $data = is_array($insights['data'] ?? null) ? $insights['data'] : [];

        $courses = [];
        foreach ($data['courses'] ?? [] as $course) {
            if (! is_array($course)) {
                continue;
            }
            $courses[] = [
                'criteria' => $course['criteria'] ?? [],
            ];
        }

        return [
            'insufficient_data' => (bool) ($data['insufficient_data'] ?? true),
            'courses' => $courses,
            'top_gaps' => collect($data['top_gaps'] ?? [])
                ->filter(fn ($gap) => is_array($gap))
                ->map(fn (array $gap) => [
                    'criterion' => $gap['criterion'] ?? null,
                    'mean' => $gap['mean'] ?? null,
                    'pct_below_4' => $gap['pct_below_4'] ?? null,
                ])
                ->values()
                ->all(),
        ];
    }

    private function systemInstruction(): string
    {
        return 'Eres el asistente pedagógico SATRE para docentes. '
            .'Recomiendas intervenciones diferenciadas según la escala Minedu vigesimal '
            .'(0–20, aprobatorio ≥ 11) y su letra cualitativa AD/A/B/C, y según los '
            .'criterios evaluativos A, B, C y D. Sugiere actividades remediales para '
            .'riesgo ALTO o MEDIO. Puedes redactar resúmenes ejecutivos para reuniones '
            .'con apoderados. Responde en español. No uses nombres, DNI ni identificadores reales.';
    }

    /**
     * @param  mixed  $items
     * @return list<string>
     */
    private function stringList(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        $out = [];
        foreach ($items as $item) {
            $text = trim((string) $item);
            if ($text !== '') {
                $out[] = $text;
            }
        }

        return array_values($out);
    }

    private function criterionOf(mixed $value): ?string
    {
        $letter = strtoupper(trim((string) $value));

        return in_array($letter, ['A', 'B', 'C', 'D'], true) ? $letter : null;
    }
}
