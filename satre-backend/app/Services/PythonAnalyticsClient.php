<?php

namespace App\Services;

use App\Support\AnalyticsPrivacy;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Único cliente HTTP hacia satre-analytics (§2, §4.6, §5).
 * Timeout 30 s y Http::retry(3, 1000) hacia http://127.0.0.1:8001.
 * Nunca lanza: si Python falla devuelve ['available' => false, 'status' => ?int].
 */
class PythonAnalyticsClient
{
    private const ATTEMPTS = 3;

    private const RETRY_SLEEP_MS = 1000;

    public function studentRisk(int $studentId, ?int $periodId = null): array
    {
        return $this->send('get', "/v1/students/$studentId/risk", array_filter(['period_id' => $periodId]));
    }

    public function batchRisk(int $periodId, ?int $classroomId = null): array
    {
        $cacheKey = "analytics:risk-batch:{$periodId}:{$classroomId}";

        return Cache::remember($cacheKey, now()->addMinutes(15), fn () => $this->send(
            'post',
            '/v1/batch/risk',
            [
                'period_id' => $periodId,
                'classroom_id' => $classroomId,
            ],
        ));
    }

    public function classroomInsights(int $classroomId, ?int $periodId = null): array
    {
        $cacheKey = "analytics:insights:{$classroomId}:{$periodId}";

        return Cache::remember($cacheKey, now()->addMinutes(15), fn () => $this->send(
            'get',
            "/v1/classrooms/$classroomId/insights",
            array_filter(['period_id' => $periodId]),
        ));
    }

    /**
     * @param  array{topic: string, course_id: ?int, criterion: ?string, message: ?string, option_id: ?string, state: ?array}  $payload
     */
    public function socraticNext(array $payload): array
    {
        return $this->send('post', '/v1/socratic/next', AnalyticsPrivacy::forTutor($payload));
    }

    /**
     * Tutor híbrido TOBE-3: Gemini + CREATE. student_id queda en el perímetro interno.
     *
     * @param  array{student_id: int, user_message: string, history?: list<array{role: string, content: string}>, topic?: ?string, create_phase?: ?string, intent?: ?string, criterion?: ?string}  $payload
     */
    public function socraticHybrid(array $payload): array
    {
        return $this->send(
            'post',
            '/api/v1/analytics/socratic-tutor',
            AnalyticsPrivacy::forHybridTutor($payload),
            30,
            self::ATTEMPTS,
            self::RETRY_SLEEP_MS,
        );
    }

    /**
     * Asistente docente TOBE-5: Gemini + brechas Minedu A–D.
     *
     * @param  array{classroom_id: int, user_message: string, student_id?: ?int, history?: list<array{role: string, content: string}>, criterion?: ?string}  $payload
     */
    public function teacherAssistant(array $payload): array
    {
        return $this->send(
            'post',
            '/api/v1/analytics/teacher-assistant',
            AnalyticsPrivacy::forTeacherAssistant($payload),
            30,
            self::ATTEMPTS,
            self::RETRY_SLEEP_MS,
        );
    }

    private function send(
        string $method,
        string $path,
        array $data,
        ?int $timeout = null,
        ?int $attempts = null,
        ?int $retrySleepMs = null,
    ): array {
        $baseUrl = config('services.python_analytics.url');

        if (blank($baseUrl)) {
            return $this->unavailable($path, null, 'not_configured');
        }

        try {
            $response = Http::withHeaders([
                'Accept' => 'application/json',
                'User-Agent' => 'SATRE-Backend/1.0',
                'X-Internal-Key' => (string) config('services.python_analytics.key'),
            ])
                ->acceptJson()
                ->timeout($timeout ?? (int) config('services.python_analytics.timeout', 30))
                ->{$method}(rtrim($baseUrl, '/').$path, $data);
        } catch (Throwable $e) {
            $status = method_exists($e, 'getCode') && is_int($e->getCode()) && $e->getCode() >= 400
                ? $e->getCode()
                : null;

            return $this->unavailable($path, $status, class_basename($e), $e->getMessage());
        }

        return $this->responseResult($response, $path);
    }

    private function responseResult(Response $response, string $path): array
    {
        $body = $response->body();
        $isCloudflareChallenge = in_array($response->status(), [403, 429], true)
            || str_contains($body, '<!DOCTYPE html>')
            || str_contains($body, 'challenges.cloudflare.com');

        if ($isCloudflareChallenge) {
            return $this->unavailable(
                $path,
                $response->status(),
                'cloudflare_blocked',
                'La respuesta de satre-analytics fue bloqueada por Cloudflare.',
            );
        }

        $json = $response->json();

        if (! $response->failed() && is_array($json)) {
            return $json + ['available' => true];
        }

        $reason = is_array($json) && is_string($json['reason'] ?? null)
            ? $json['reason']
            : 'http_error';

        return $this->unavailable(
            $path,
            $response->status(),
            $reason,
            $this->failureMessage($json, $response),
        );
    }

    private function failureMessage(mixed $json, Response $response): string
    {
        $jsonMessage = is_array($json) && is_string($json['message'] ?? null) ? $json['message'] : null;

        return $jsonMessage ?? ($response->body() ?: sprintf('HTTP %s desde satre-analytics.', $response->status()));
    }

    private function unavailable(string $path, ?int $status, string $reason, ?string $message = null): array
    {
        Log::warning('satre-analytics no disponible', [
            'endpoint' => preg_replace('/\d+/', '{id}', $path),
            'status' => $status,
            'reason' => $reason,
            'message' => $message,
        ]);

        return array_filter([
            'available' => false,
            'status' => $status,
            'reason' => $reason,
            'message' => $message,
        ], fn ($value) => $value !== null);
    }
}
