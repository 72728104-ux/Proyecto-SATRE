<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Cliente HTTP hacia Gemini (SATRE TOBE-4). Prueba modelos configurados
 * en orden de prioridad y nunca lanza excepciones al caller.
 */
class GeminiClient
{
    public const MODEL = 'gemini-3.5-flash-lite';

    /** @var list<string> */
    public const FALLBACK_MODELS = [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-3.8-flash',
        'gemini-3-flash-preview',
        'gemma-4-31b-it',
        'gemma-4-26b-it',
    ];

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

        foreach (self::FALLBACK_MODELS as $model) {
            $modelPayload = $payload;

            if (str_starts_with($model, 'gemma-')) {
                unset($modelPayload['system_instruction']);
                $instruction = trim((string) $systemInstruction);

                if ($instruction !== '') {
                    $modelPayload['contents'][0]['parts'][0]['text'] = $instruction."\n\n".$prompt;
                }
            }

            try {
                $response = Http::acceptJson()
                    ->timeout(12)
                    ->post($this->endpoint($model, (string) $key), $modelPayload);

                if ($response->successful()) {
                    $result = $this->responseResult($response);

                    if (($result['available'] ?? false) === true) {
                        return $result;
                    }
                }

                Log::warning('gemini: modelo no disponible', [
                    'model' => $model,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            } catch (Throwable $e) {
                Log::warning('gemini: excepción HTTP', [
                    'model' => $model,
                    'exception' => $e::class,
                    'message' => $this->redact((string) $e->getMessage()),
                ]);
            }
        }

        return $this->unavailable(
            'gemini_unavailable',
            'Todos los modelos Gemini están temporalmente saturados o no disponibles.',
            503,
        );
    }

    /**
     * @return array{available: bool, text?: string, reason?: string, message?: string, status?: int}
     */
    private function responseResult(Response $response): array
    {
        if ($response->failed()) {
            return $this->unavailable(
                $this->reasonFromStatus($response->status()),
                $this->redact($response->json('error.message') ?: sprintf('HTTP %s desde Gemini.', $response->status())),
                $response->status(),
            );
        }

        $text = $this->extractText($response);

        return $text !== null && $text !== ''
            ? ['available' => true, 'text' => $text]
            : $this->unavailable('invalid_response', 'Gemini no devolvió texto utilizable.', $response->status());
    }

    private function endpoint(string $model, string $apiKey): string
    {
        $base = rtrim((string) config('services.gemini.base_url'), '/');
        $base = rtrim(preg_replace('#/models/?$#', '', $base) ?: $base, '/');

        return $base.'/models/'.rawurlencode($model).':generateContent?key='.rawurlencode($apiKey);
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
