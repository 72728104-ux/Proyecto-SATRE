<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Único cliente HTTP hacia satre-analytics (§2, §4.6, §5).
 * Timeout 8 s, header X-Internal-Key, 1 reintento. Nunca lanza: si Python
 * falla devuelve ['available' => false, 'status' => ?int].
 */
class AnalyticsClient
{
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
     * @param  array{topic: string, course_id: ?int, message: ?string, option_id: ?string, state: ?array}  $payload
     */
    public function socraticNext(array $payload): array
    {
        return $this->send('post', '/v1/socratic/next', $payload);
    }

    private function send(string $method, string $path, array $data): array
    {
        $baseUrl = config('services.python_analytics.url');

        if (blank($baseUrl)) {
            return $this->unavailable($path, null, 'not_configured');
        }

        try {
            $response = Http::withHeaders(['X-Internal-Key' => (string) config('services.python_analytics.key')])
                ->acceptJson()
                ->timeout((int) config('services.python_analytics.timeout', 8))
                ->retry(2, self::RETRY_SLEEP_MS, throw: false)
                ->{$method}(rtrim($baseUrl, '/').$path, $data);
        } catch (Throwable $e) {
            return $this->unavailable($path, null, class_basename($e));
        }

        $json = $response->json();

        if ($response->failed() || ! is_array($json)) {
            return $this->unavailable($path, $response->status(), 'http_error');
        }

        return ['available' => true] + $json;
    }

    private function unavailable(string $path, ?int $status, string $reason): array
    {
        Log::warning('satre-analytics no disponible', [
            'endpoint' => preg_replace('/\d+/', '{id}', $path),
            'status' => $status,
            'reason' => $reason,
        ]);

        return ['available' => false, 'status' => $status];
    }
}
