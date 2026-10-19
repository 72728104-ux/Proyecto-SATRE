<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Cliente HTTP hacia Gemini (SATRE TOBE-4). Reintentos Http::retry(3, 1000)
 * y modelo operativo gemini-1.5-flash. Nunca lanza al caller.
 */
class GeminiClient
{
    public const MODEL = 'gemini-1.5-flash';

    public const ATTEMPTS = 3;

    public const RETRY_SLEEP_MS = 1000;

    /**
     * @return array{available: bool, text?: string, reason?: string, message?: string, status?: int}
     */
    public function generate(string $prompt, ?string $systemInstruction = null): array
    {
        $key = config('services.gemini.key');
        if (blank($key)) {
            return $this->unavailable('not_configured', 'GEMINI_API_KEY no está configurada.');
        }

        $model = (string) (config('services.gemini.model') ?: self::MODEL);
        $payload = array_filter([
            'system_instruction' => filled($systemInstruction)
                ? ['parts' => [['text' => $systemInstruction]]]
                : null,
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $prompt]]],
            ],
            'generationConfig' => [
                'temperature' => 0.4,
            ],
        ]);

        try {
            $response = Http::withHeaders([
                'x-goog-api-key' => (string) $key,
            ])
                ->acceptJson()
                ->timeout((int) config('services.gemini.timeout', 30))
                ->retry(self::ATTEMPTS, self::RETRY_SLEEP_MS)
                ->post($this->endpoint($model), $payload);
        } catch (Throwable $e) {
            Log::warning('gemini: excepción HTTP', [
                'exception' => $e::class,
                'message' => $this->redact((string) $e->getMessage()),
            ]);

            return $this->unavailable(
                class_basename($e) === 'ConnectionException' ? 'timeout' : 'gemini_unavailable',
                'No se pudo completar la solicitud a Gemini.',
            );
        }

        if ($response->failed()) {
            return $this->unavailable(
                $this->reasonFromStatus($response->status()),
                $this->redact($response->json('error.message') ?: sprintf('HTTP %s desde Gemini.', $response->status())),
                $response->status(),
            );
        }

        $text = $this->extractText($response);
        if ($text === null || $text === '') {
            return $this->unavailable('invalid_response', 'Gemini no devolvió texto utilizable.', $response->status());
        }

        return ['available' => true, 'text' => $text];
    }

    private function endpoint(string $model): string
    {
        $base = rtrim((string) config('services.gemini.base_url'), '/');

        return $base.'/models/'.$model.':generateContent';
    }

    private function extractText(Response $response): ?string
    {
        $parts = $response->json('candidates.0.content.parts');
        if (! is_array($parts)) {
            return null;
        }

        $chunks = [];
        foreach ($parts as $part) {
            if (is_string($part['text'] ?? null) && $part['text'] !== '') {
                $chunks[] = $part['text'];
            }
        }

        $text = trim(implode("\n", $chunks));

        return $text !== '' ? $text : null;
    }

    private function reasonFromStatus(int $status): string
    {
        return match ($status) {
            401, 403 => 'auth_error',
            408 => 'timeout',
            429 => 'quota_exhausted',
            default => 'gemini_unavailable',
        };
    }

    /**
     * @return array{available: false, reason: string, message: string, status?: int}
     */
    private function unavailable(string $reason, string $message, ?int $status = null): array
    {
        return array_filter([
            'available' => false,
            'reason' => $reason,
            'message' => $message,
            'status' => $status,
        ], fn ($value) => $value !== null);
    }

    private function redact(string $detail): string
    {
        $key = (string) config('services.gemini.key');

        return $key !== '' ? str_replace($key, '[REDACTED]', $detail) : $detail;
    }
}
