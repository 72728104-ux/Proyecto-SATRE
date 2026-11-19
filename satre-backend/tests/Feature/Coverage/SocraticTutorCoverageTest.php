<?php

namespace Tests\Feature\Coverage;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\Student;
use App\Models\TutorSession;
use App\Models\User;
use App\Services\PythonAnalyticsClient;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use RuntimeException;
use Tests\TestCase;

/**
 * Cubre ramas alternativas del tutor socrático: cierre de sesión, pistas,
 * artículo co-escrito, fallback y excepción del cliente Python.
 */
class SocraticTutorCoverageTest extends TestCase
{
    use RefreshDatabase;

    private const BASE_URL = 'http://analytics.test';

    private const PYTHON_ENDPOINT = '/api/v1/analytics/socratic-tutor';

    private const TURN_ENDPOINT = '/api/ai-analytics/student/socratic-tutor';

    private const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    private Course $course;

    private Student $student;

    private User $studentUser;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.python_analytics.url' => self::BASE_URL,
            'services.python_analytics.key' => 'test-internal-key',
            'services.gemini.key' => null,
        ]);

        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $classroom = Classroom::factory()->create(['academic_period_id' => $period->id]);
        $this->course = Course::factory()->create([
            'classroom_id' => $classroom->id,
            'academic_period_id' => $period->id,
        ]);
        $this->studentUser = $this->userWithRole(Roles::STUDENT);
        $this->student = Student::factory()->create([
            'user_id' => $this->studentUser->id,
            'classroom_id' => $classroom->id,
        ]);
        Enrollment::factory()->create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
        ]);
    }

    public function test_hybrid_done_status_hint_increment_and_evaluate_completion(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_ENDPOINT => Http::sequence()
                ->push($this->hybridTurn('evaluar', '¿Cómo lo aplicarías?', done: true))
                ->push($this->hybridTurn('explicar', 'Piensa en la pendiente.'))
                ->push($this->hybridTurn('evaluar', 'Cierra con tu reflexión.')),
        ]);

        $completed = $this->session();
        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::TURN_ENDPOINT, ['session_id' => $completed->id, 'message' => 'Terminemos'])
            ->assertOk()
            ->assertJsonPath('data.session.status', TutorSession::STATUS_COMPLETED);

        $hinted = $this->session(['create_phase' => 'explicar', 'hint_level' => 1]);
        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::TURN_ENDPOINT, ['session_id' => $hinted->id, 'message' => '[HINT]'])
            ->assertOk()
            ->assertJsonPath('data.session.hint_level', 2)
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE);

        $this->assertSame(2, $hinted->fresh()->state['hint_level']);

        $evaluating = $this->session(['create_phase' => 'evaluar', 'hint_level' => 0]);
        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::TURN_ENDPOINT, ['session_id' => $evaluating->id, 'message' => 'Ya terminé mi artículo'])
            ->assertOk()
            ->assertJsonPath('data.done', true)
            ->assertJsonPath('data.session.status', TutorSession::STATUS_COMPLETED);
    }

    public function test_article_intents_use_gemini_for_every_task(): void
    {
        config([
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-1.5-flash',
            'services.gemini.base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ]);
        Http::fake([
            self::GEMINI_ENDPOINT => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => 'Texto académico revisado.']]]],
                ],
            ]),
        ]);

        $session = $this->session();

        foreach (['ARTICLE_PROOFREAD', 'ARTICLE_SYNTH', 'ARTICLE_CITE', 'ARTICLE_COWRITE'] as $intent) {
            $this->actingAs($this->studentUser, 'sanctum')
                ->postJson(self::TURN_ENDPOINT, [
                    'session_id' => $session->id,
                    'message' => "[{$intent}]\nTítulo: Pendiente\nFase: explicar\n---\nBorrador del estudiante.",
                ])
                ->assertOk()
                ->assertJsonPath('available', true)
                ->assertJsonPath('data.reply.type', 'article')
                ->assertJsonPath('data.reply.text', 'Texto académico revisado.')
                ->assertJsonPath('data.session.article.title', 'Pendiente');

            $this->assertSame('gemini', $session->fresh()->state['engine']);
        }
    }

    public function test_article_uses_hybrid_then_fallback_when_gemini_is_unavailable(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_ENDPOINT => Http::sequence()
                ->push($this->hybridTurn('explicar', 'Co-escribe el siguiente párrafo.'))
                ->push(['available' => false, 'reason' => 'database_error', 'message' => 'sin contexto']),
        ]);

        $session = $this->session();

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::TURN_ENDPOINT, [
                'session_id' => $session->id,
                'message' => "[ARTICLE_COWRITE]\nTítulo: Mi artículo\nFase: aplicar\n---\nPrimer párrafo.",
            ])
            ->assertOk()
            ->assertJsonPath('data.reply.type', 'article')
            ->assertJsonPath('data.reply.text', 'Co-escribe el siguiente párrafo.');

        $this->assertSame('hybrid', $session->fresh()->state['engine']);
        $this->assertSame('Mi artículo', $session->fresh()->state['article']['title']);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::TURN_ENDPOINT, [
                'session_id' => $session->id,
                'message' => "[ARTICLE_CITE]\nTítulo: Mi artículo\nFase: aplicar\n---\nSegundo párrafo.",
            ])
            ->assertOk()
            ->assertJsonPath('data.reply.type', 'article')
            ->assertJsonPath('data.reply.text', 'No pude consultar a la IA ahora. Sigue el paso C.R.E.A.T.E. indicado y escribe un párrafo con tus palabras; luego reintenta la asistencia.');

        $this->assertSame('fallback', $session->fresh()->state['engine']);
    }

    public function test_python_client_exception_falls_back_to_courtesy_reply(): void
    {
        $client = Mockery::mock(PythonAnalyticsClient::class);
        $client->shouldReceive('socraticHybrid')->once()->andThrow(new RuntimeException('boom'));
        $this->app->instance(PythonAnalyticsClient::class, $client);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::TURN_ENDPOINT, [
                'course_id' => $this->course->id,
                'topic' => 'Funciones lineales',
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', 'Ahora no pude consultar al tutor de IA. Mientras se restablece, cuéntame con tus palabras qué recuerdas de «Funciones lineales». ¿Qué parte te resulta más confusa?');

        $this->assertSame('fallback', TutorSession::query()->sole()->state['engine']);
    }

    public function test_direct_gemini_hint_increments_hint_level(): void
    {
        config([
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-1.5-flash',
            'services.gemini.base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ]);
        Http::fake([
            self::BASE_URL.self::PYTHON_ENDPOINT => Http::response('upstream crash', 500),
            self::GEMINI_ENDPOINT => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => '¿Qué cambia en y cuando x aumenta?']]]],
                ],
            ]),
        ]);

        $session = $this->session(['create_phase' => 'explicar', 'hint_level' => 1]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::TURN_ENDPOINT, ['session_id' => $session->id, 'message' => '[HINT]'])
            ->assertOk()
            ->assertJsonPath('data.reply.text', '¿Qué cambia en y cuando x aumenta?')
            ->assertJsonPath('data.session.hint_level', 2);

        $this->assertSame('gemini', $session->fresh()->state['engine']);
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function session(array $state = []): TutorSession
    {
        return TutorSession::query()->create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
            'topic' => 'Funciones lineales',
            'status' => TutorSession::STATUS_ACTIVE,
            'state' => $state + ['version' => 2, 'step' => 'diagnostico', 'hint_level' => 0],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function hybridTurn(string $phase, string $text, bool $done = false): array
    {
        return [
            'available' => true,
            'insufficient_data' => false,
            'create_phase' => $phase,
            'done' => $done,
            'socratic_response' => [
                'available' => true,
                'guidance' => $text,
                'create_phase' => $phase,
                'explanation' => $text,
            ],
            'reply' => [
                'type' => 'question',
                'text' => $text,
                'create_phase' => $phase,
                'explanation' => $text,
                'reflection' => 'Explica cómo lo pensaste.',
            ],
        ];
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);

        return User::factory()->create([
            'role_id' => $role->id,
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
