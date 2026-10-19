<?php

namespace Tests\Unit;

use App\Services\GeminiClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GeminiClientTest extends TestCase
{
    public function test_generate_posts_to_gemini_15_flash_with_three_retries(): void
    {
        config([
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-1.5-flash',
            'services.gemini.base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ]);

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' => Http::sequence()
                ->push(['error' => ['message' => 'busy']], 503)
                ->push(['error' => ['message' => 'busy']], 503)
                ->push([
                    'candidates' => [
                        ['content' => ['parts' => [['text' => '¿Qué recuerdas de la pendiente?']]]],
                    ],
                ]),
        ]);

        $result = app(GeminiClient::class)->generate('Tema: pendiente');

        $this->assertTrue($result['available']);
        $this->assertSame('¿Qué recuerdas de la pendiente?', $result['text']);
        Http::assertSentCount(3);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'models/gemini-1.5-flash:generateContent')
            && $request->hasHeader('x-goog-api-key', 'test-gemini-key'));
    }

    public function test_skips_request_when_key_is_missing(): void
    {
        config(['services.gemini.key' => null]);
        Http::fake();

        $result = app(GeminiClient::class)->generate('hola');

        $this->assertFalse($result['available']);
        $this->assertSame('not_configured', $result['reason']);
        Http::assertNothingSent();
    }
}
