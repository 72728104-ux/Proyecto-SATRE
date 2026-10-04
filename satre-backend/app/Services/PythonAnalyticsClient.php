<?php

namespace App\Services;

use App\Support\AnalyticsPrivacy;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Único cliente HTTP hacia satre-analytics (§2, §4.6, §5).
 * Timeout 8 s, header X-Internal-Key, 1 reintento. Nunca lanza: si Python
 * falla devuelve ['available' => false, 'status' => ?int].
 */
class PythonAnalyticsClient
{
    private const ATTEMPTS = 2;

    private const RETRY_SLEEP_MS = 200;

    public function studentRisk(int $studentId, ?int $periodId = null): array
    {
        return $this->send('get', "/v1/students/$studentId/risk", array_filter(['period_id' => $periodId]));
    }

    public function batchRisk(int $periodId, ?int $classroomId = null): array
    {
        return $this->send('post', '/v1/batch/risk', [
            'period_id' => $periodId,
            'classroom_id' => $classroomId,
        ]);
    }

    public function classroomInsights(int $classroomId, ?int $periodId = null): array
    {
        return $this->send('get', "/v1/classrooms/$classroomId/insights", array_filter(['period_id' => $periodId]));
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
        // Gemini puede superar el timeout de 8 s del motor determinista.
        $timeout = max((int) config('services.python_analytics.timeout', 8), 30);

        return $this->send(
            'post',
            '/api/v1/analytics/socratic-tutor',
            AnalyticsPrivacy::forHybridTutor($payload),
            $timeout,
        );
    }

    private function send(string $method, string $path, array $data, ?int $timeout = null): array
    {
        $baseUrl = config('services.python_analytics.url');

        if (blank($baseUrl)) {
            return $this->unavailable($path, null, 'not_configured');
        }

        try {
            $response = Http::withHeaders(['X-Internal-Key' => (string) config('services.python_analytics.key')])
                ->acceptJson()
                ->timeout($timeout ?? (int) config('services.python_analytics.timeout', 8))
                ->retry(self::ATTEMPTS, self::RETRY_SLEEP_MS, throw: false)
                ->{$method}(rtrim($baseUrl, '/').$path, $data);
        } catch (Throwable $e) {
            return $this->unavailable($path, null, class_basename($e));
        }

        $json = $response->json();

        if ($response->failed() || ! is_array($json)) {
            $reason = is_array($json) && is_string($json['reason'] ?? null)
                ? $json['reason']
                : 'http_error';
            $message = is_array($json) && is_string($json['message'] ?? null)
                ? $json['message']
                : null;

            return $this->unavailable($path, $response->status(), $reason, $message);
        }

        return ['available' => true] + $json;
    }

    private function unavailable(string $path, ?int $status, string $reason, ?string $message = null): array
    {
        Log::warning('satre-analytics no disponible', [
            'endpoint' => preg_replace('/\d+/', '{id}', $path),
            'status' => $status,
            'reason' => $reason,
        ]);

        return array_filter([
            'available' => false,
            'status' => $status,
            'reason' => $reason,
            'message' => $message,
        ], fn ($value) => $value !== null);
    }
}
