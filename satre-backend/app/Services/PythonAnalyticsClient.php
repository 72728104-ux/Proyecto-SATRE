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
 * En Render el servicio se consume por su URL pública, detrás de Cloudflare:
 * se envían cabeceras de cliente legítimo, se reintenta una sola vez ante 429
 * y se cachean 10 min las respuestas exitosas de insights y batch.
 * Nunca lanza: si Python falla devuelve ['available' => false, 'status' => ?int].
 */
class PythonAnalyticsClient
{
    private const ATTEMPTS = 3;

    private const RETRY_SLEEP_MS = 1000;

    private const RATE_LIMIT_SLEEP_US = 1500000;

    private const CACHE_MINUTES = 10;

    private const USER_AGENT = 'Mozilla/5.0 (compatible; SATRE-Backend/1.0; +https://satre-coar-junin.netlify.app)';

    public function studentRisk(int $studentId, ?int $periodId = null): array
    {
        return $this->send('get', "/v1/students/$studentId/risk", array_filter(['period_id' => $periodId]));
    }

    public function batchRisk(int $periodId, ?int $classroomId = null): array
    {
        $cacheKey = "analytics:risk-batch:{$periodId}:{$classroomId}";

        return $this->rememberSuccessful($cacheKey, fn () => $this->send(
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

        return $this->rememberSuccessful($cacheKey, fn () => $this->send(
            'get',
            "/v1/classrooms/$classroomId/insights",
            array_filter(['period_id' => $periodId]),
        ));
    }

    /**
     * Cache::remember solo conserva respuestas exitosas; los fallos se olvidan
     * de inmediato para no bloquear el siguiente intento durante 10 minutos.
     *
     * @param  callable(): array<string, mixed>  $callback
     * @return array<string, mixed>
     */
    private function rememberSuccessful(string $cacheKey, callable $callback): array
    {
        $result = Cache::remember($cacheKey, now()->addMinutes(self::CACHE_MINUTES), $callback);

        if (! ($result['available'] ?? false)) {
            Cache::forget($cacheKey);
        }

        return $result;
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

        $timeout ??= (int) config('services.python_analytics.timeout', 30);
        $attempts = max(1, $attempts ?? self::ATTEMPTS);
        $retrySleepMs = max(0, $retrySleepMs ?? self::RETRY_SLEEP_MS);
        $rateLimitRetried = false;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            try {
                $response = Http::withHeaders([
                    'Accept' => 'application/json',
                    'User-Agent' => self::USER_AGENT,
                    'X-Internal-Key' => (string) config('services.python_analytics.key'),
                ])
                    ->acceptJson()
                    ->timeout($timeout)
                    ->{$method}(rtrim($baseUrl, '/').$path, $data);
            } catch (Throwable $e) {
                if ($attempt < $attempts) {
                    usleep($retrySleepMs * 1000);

                    continue;
                }

                $status = method_exists($e, 'getCode') && is_int($e->getCode()) && $e->getCode() >= 400
                    ? $e->getCode()
                    : null;

                return $this->unavailable($path, $status, class_basename($e), $e->getMessage());
            }

            if ($response->status() === 429) {
                if (! $rateLimitRetried && $attempt < $attempts) {
                    $rateLimitRetried = true;
                    usleep(self::RATE_LIMIT_SLEEP_US);

                    continue;
                }

                return $this->responseResult($response, $path);
            }

            if ($response->serverError() && $attempt < $attempts) {
                usleep($retrySleepMs * 1000);

                continue;
            }

            return $this->responseResult($response, $path);
        }

        return $this->unavailable($path, null, 'retry_exhausted');
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
