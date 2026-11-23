<?php

namespace Tests\Unit;

use App\Services\GeminiClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GeminiClientTest extends TestCase
{
    public function test_skips_request_when_key_is_missing(): void
    {
        config(['services.gemini.key' => null]);
        Http::fake();

        $result = app(GeminiClient::class)->generate('hola');

        $this->assertFalse($result['available']);
        $this->assertSame('not_configured', $result['reason']);
        Http::assertNothingSent();
    }

    public function test_generate_falls_back_across_gemini_and_gemma_models(): void
    {
        config([
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-3.5-flash-lite',
            'services.gemini.base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ]);

        Http::fake([
            '*models/gemini-3.5-flash-lite:generateContent*' => Http::response(['error' => ['message' => 'busy']], 503),
            '*models/gemini-3.1-flash-lite-preview:generateContent*' => Http::response(['error' => ['message' => 'busy']], 503),
            '*models/gemini-3.8-flash:generateContent*' => Http::response(['error' => ['message' => 'not found']], 404),
            '*models/gemini-3-flash-preview:generateContent*' => Http::response(['error' => ['message' => 'not found']], 404),
            '*models/gemma-4-31b-it:generateContent*' => Http::response([
                'candidates' => [['content' => ['parts' => [['text' => 'Respuesta Gemma']]]]],
            ]),
        ]);

        $result = app(GeminiClient::class)->generate('Tema: pendiente', 'Instrucción del sistema');

        $this->assertTrue($result['available']);
        $this->assertSame('Respuesta Gemma', $result['text']);
        Http::assertSentCount(5);

        Http::assertSent(function ($request) {
            $data = $request->data();
            $text = $data['contents'][0]['parts'][0]['text'] ?? '';

            return str_contains($request->url(), '/models/gemma-4-31b-it:generateContent')
                && str_contains($request->url(), '?key=test-gemini-key')
                && ! array_key_exists('systemInstruction', $data)
                && str_contains($text, 'Instrucción del sistema');
        });
    }

    public function test_generate_returns_503_when_every_model_fails(): void
    {
        config([
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-3.5-flash-lite',
            'services.gemini.base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ]);

        Http::fake(fn () => Http::response(['error' => ['message' => 'busy']], 503));

        $result = app(GeminiClient::class)->generate('Tema: pendiente');

        $this->assertFalse($result['available']);
        $this->assertSame('gemini_unavailable', $result['reason']);
        $this->assertSame(503, $result['status']);
        Http::assertSentCount(6);
    }
}
