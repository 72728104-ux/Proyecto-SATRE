<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\RiskPrediction;
use App\Models\Role;
use App\Models\Student;
use App\Models\TutorMessage;
use App\Models\TutorSession;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * §4.6 / TOBE-3: puente Laravel → satre-analytics /api/v1/analytics/socratic-tutor (Gemini).
 * El catálogo /v1/socratic/next no se usa como fallback.
 */
class SocraticTutorTest extends TestCase
{
    use RefreshDatabase;

    private const BASE_URL = 'http://analytics.test';

    private const ENDPOINT = '/api/ai-analytics/student/socratic-tutor';

    private const DELETE_ENDPOINT = '/api/v1/socratic/sessions';

    private const PYTHON_SOCRATIC_ENDPOINT = '/api/v1/analytics/socratic-tutor';
    private const PYTHON_NEXT_ENDPOINT = '/v1/socratic/next';
    private const TOPIC_LINEAR_FUNCTIONS = 'Funciones lineales';
    private const OPTION_LINE = 'Una recta';
    private const TOPIC_PHOTOSYNTHESIS = 'Fotosíntesis';
    private const GUIDANCE_SLOPE = '¿Qué ya sabes de la pendiente?';
    private const REFLECTION_DAILY_EXAMPLE = 'Escribe un ejemplo de tu vida diaria.';
    private const OPTION_Y_INTERCEPT = 'Un corte con el eje y';
    private const OPTION_SLOPE_CHANGE = 'Cuánto cambia y al aumentar x';
    private const MERMAID_SLOPE_DIAGRAM = "flowchart TD\n    A[Δy] --> M[pendiente]";

    private Course $course;

    private Student $student;

    private User $studentUser;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.python_analytics.url' => self::BASE_URL,
            'services.python_analytics.key' => 'test-internal-key',
        ]);

        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $classroom = Classroom::factory()->create(['academic_period_id' => $period->id]);
        $this->course = Course::factory()->create(['classroom_id' => $classroom->id, 'academic_period_id' => $period->id]);
        $this->studentUser = $this->userWithRole(Roles::STUDENT);
        $this->student = Student::factory()->create(['user_id' => $this->studentUser->id, 'classroom_id' => $classroom->id]);
        Enrollment::factory()->create(['student_id' => $this->student->id, 'course_id' => $this->course->id]);
    }

    public function test_student_starts_session_and_turn_is_persisted(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response($this->hybridTurn('conectar', '¿Qué forma tiene el gráfico?', [
                ['id' => 'a', 'text' => self::OPTION_LINE],
                ['id' => 'b', 'text' => 'Una parábola'],
            ])),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE)
            ->assertJsonPath('data.session.create_phase', 'conectar')
            ->assertJsonPath('data.session.step', 'diagnostico')
            ->assertJsonPath('data.reply.type', 'question')
            ->assertJsonPath('data.reply.options.1.text', 'Una parábola')
            ->assertJsonPath('data.done', false)
            ->assertJsonMissingPath('data.session.state');

        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Internal-Key', 'test-internal-key')
            && str_ends_with($request->url(), self::PYTHON_SOCRATIC_ENDPOINT)
            && $request['student_id'] === $this->student->id
            && $request['topic'] === self::TOPIC_LINEAR_FUNCTIONS
            && $request['user_message'] === self::TOPIC_LINEAR_FUNCTIONS);
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_NEXT_ENDPOINT));

        $session = TutorSession::query()->sole();
        $this->assertSame('conectar', $session->state['create_phase']);
        $this->assertSame(['student', 'tutor'], $session->messages()->pluck('role')->all());
    }

    public function test_student_starts_session_preloading_ib_criterion(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response($this->hybridTurn('conectar', '¿Qué recuerdas de la fotosíntesis?')),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'course_id' => $this->course->id,
                'topic' => self::TOPIC_PHOTOSYNTHESIS,
                'criterion' => 'B',
            ])
            ->assertOk()
            ->assertJsonPath('data.session.topic', self::TOPIC_PHOTOSYNTHESIS)
            ->assertJsonPath('data.session.criterion', 'B');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_SOCRATIC_ENDPOINT)
            && $request['topic'] === self::TOPIC_PHOTOSYNTHESIS
            && ($request['criterion'] ?? null) === 'B');
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_NEXT_ENDPOINT));

        $this->assertSame('B', TutorSession::query()->sole()->criterion);
    }

    public function test_invalid_ib_criterion_is_rejected(): void
    {
        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'course_id' => $this->course->id,
                'topic' => self::TOPIC_PHOTOSYNTHESIS,
                'criterion' => 'E',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['criterion']);
    }

    public function test_follow_up_turn_forwards_state_and_stores_chosen_option_text(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::sequence()
                ->push($this->hybridTurn('conectar', '¿Qué forma tiene?', [['id' => 'a', 'text' => self::OPTION_LINE]]))
                ->push($this->hybridTurn('recordar', '¿Qué es la pendiente?')),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('pregunta_guia', 'question')),
        ]);

        $sessionId = $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->json('data.session.id');

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['session_id' => $sessionId, 'option_id' => 'a'])
            ->assertOk()
            ->assertJsonPath('data.session.id', $sessionId)
            ->assertJsonPath('data.session.create_phase', 'recordar')
            ->assertJsonPath('data.session.step', 'pregunta_guia');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_SOCRATIC_ENDPOINT)
            && $request['user_message'] === self::OPTION_LINE);
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_NEXT_ENDPOINT));

        $this->assertDatabaseHas('tutor_messages', ['tutor_session_id' => $sessionId, 'role' => 'student', 'content' => self::OPTION_LINE]);
        $this->assertSame(4, TutorSession::query()->find($sessionId)->messages()->count());
    }

    public function test_student_misconception_is_forwarded_to_gemini_without_catalog(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::sequence()
                ->push($this->hybridTurn('conectar', '¿Qué es la pendiente de una recta?'))
                ->push($this->hybridTurn('explicar', 'La pendiente no es el eje. ¿Qué cambia en y cuando aumenta x?')),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('pista', 'hint')),
        ]);

        $sessionId = $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Pendiente'])
            ->json('data.session.id');

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['session_id' => $sessionId, 'message' => 'el eje'])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', 'La pendiente no es el eje. ¿Qué cambia en y cuando aumenta x?');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_SOCRATIC_ENDPOINT)
            && $request['user_message'] === 'el eje');
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_NEXT_ENDPOINT));
    }

    public function test_insufficient_academic_context_still_persists_when_gemini_replies(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response($this->hybridTurn(
                'conectar',
                '¿Qué recuerdas de las funciones lineales?',
                insufficient: true,
            )),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', '¿Qué recuerdas de las funciones lineales?')
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE);

        $this->assertSame(1, TutorSession::query()->count());
    }

    public function test_analytics_http_500_returns_courtesy_fallback(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response('upstream crash', 500),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', $this->courtesyText(self::TOPIC_LINEAR_FUNCTIONS));

        $this->assertSame(1, TutorSession::query()->count());
    }

    public function test_analytics_database_error_returns_200_without_storing(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response([
                'available' => false,
                'insufficient_data' => true,
                'reason' => 'database_error',
                'message' => 'No se pudo leer el contexto académico del tutor.',
            ]),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null)
            ->assertJsonPath('reason', 'database_error')
            ->assertJsonPath('message', 'No se pudo leer el contexto académico del tutor.');

        $this->assertSame(0, TutorSession::query()->count());
    }

    public function test_gemini_failure_uses_courtesy_fallback_without_catalog(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response([
                'insufficient_data' => false,
                'socratic_response' => [
                    'available' => false,
                    'reason' => 'quota_exhausted',
                    'message' => 'La cuota de la API de IA está agotada.',
                    'http_status' => 429,
                    'provider_status' => 'RESOURCE_EXHAUSTED',
                    'provider_error' => 'quota',
                ],
            ]),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('diagnostico', 'question', [
                ['id' => 'a', 'text' => 'Pista 1: Piensa en cuánto sube'],
            ])),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE)
            ->assertJsonPath('data.done', false)
            ->assertJsonFragment(['text' => $this->courtesyText(self::TOPIC_LINEAR_FUNCTIONS)]);

        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_NEXT_ENDPOINT));
        $this->assertSame(1, TutorSession::query()->count());
        $this->assertSame('fallback', TutorSession::query()->sole()->state['engine']);
    }

    public function test_gemini_http_errors_log_and_return_courtesy_fallback(): void
    {
        foreach ([
            [401, 'auth_error', 'La API Key de IA fue rechazada.'],
            [429, 'quota_exhausted', 'La cuota de la API de IA está agotada.'],
            [503, 'api_unavailable', 'La API de IA no está disponible temporalmente.'],
        ] as [$status, $reason, $message]) {
            Http::fake([
                self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response([
                    'socratic_response' => [
                        'available' => false,
                        'reason' => $reason,
                        'message' => $message,
                        'http_status' => $status,
                        'provider_status' => 'UNAVAILABLE',
                        'provider_error' => "HTTP {$status}",
                    ],
                ]),
            ]);

            $this->actingAs($this->studentUser, 'sanctum')
                ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Pendiente'])
                ->assertOk()
                ->assertJsonPath('available', true)
                ->assertJsonPath('data.reply.text', $this->courtesyText('Pendiente'));

            TutorMessage::query()->delete();
            TutorSession::query()->delete();
        }
    }

    public function test_tutor_chat_alias_forwards_to_python_and_persists(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response($this->hybridTurn('conectar', self::GUIDANCE_SLOPE, [
                ['id' => 'a', 'text' => self::OPTION_LINE],
            ])),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson('/api/v1/tutor/chat', ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.type', 'question')
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE);

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_SOCRATIC_ENDPOINT)
            && $request['topic'] === self::TOPIC_LINEAR_FUNCTIONS
            && $request->hasHeader('X-Internal-Key', 'test-internal-key'));
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_NEXT_ENDPOINT));
        $this->assertSame(1, TutorSession::query()->count());
        $this->assertSame(['student', 'tutor'], TutorSession::query()->sole()->messages()->pluck('role')->all());
    }

    public function test_hybrid_create_reply_is_used_when_gemini_available(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response([
                'insufficient_data' => false,
                'create_phase' => 'conectar',
                'done' => false,
                'socratic_response' => [
                    'available' => true,
                    'guidance' => self::GUIDANCE_SLOPE,
                    'create_phase' => 'conectar',
                    'explanation' => self::GUIDANCE_SLOPE,
                    'reflection' => self::REFLECTION_DAILY_EXAMPLE,
                    'quiz' => [
                        'question' => 'La pendiente describe…',
                        'options' => [
                            ['id' => 'a', 'text' => self::OPTION_Y_INTERCEPT],
                            ['id' => 'b', 'text' => self::OPTION_SLOPE_CHANGE],
                        ],
                    ],
                    'diagram_mermaid' => self::MERMAID_SLOPE_DIAGRAM,
                    'visual_resource' => ['title' => 'Recta', 'description' => 'Sube al avanzar'],
                ],
                'reply' => [
                    'type' => 'question',
                    'text' => "¿Qué ya sabes de la pendiente?\n\nEscribe un ejemplo de tu vida diaria.",
                    'create_phase' => 'conectar',
                    'explanation' => self::GUIDANCE_SLOPE,
                    'reflection' => self::REFLECTION_DAILY_EXAMPLE,
                    'quiz' => [
                        'question' => 'La pendiente describe…',
                        'options' => [
                            ['id' => 'a', 'text' => self::OPTION_Y_INTERCEPT],
                            ['id' => 'b', 'text' => self::OPTION_SLOPE_CHANGE],
                        ],
                    ],
                    'diagram_mermaid' => self::MERMAID_SLOPE_DIAGRAM,
                    'options' => [
                        ['id' => 'a', 'text' => self::OPTION_Y_INTERCEPT],
                        ['id' => 'b', 'text' => self::OPTION_SLOPE_CHANGE],
                    ],
                ],
            ]),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.session.create_phase', 'conectar')
            ->assertJsonPath('data.reply.create_phase', 'conectar')
            ->assertJsonPath('data.reply.quiz.options.1.text', self::OPTION_SLOPE_CHANGE)
            ->assertJsonPath('data.reply.diagram_mermaid', self::MERMAID_SLOPE_DIAGRAM)
            ->assertJsonPath('data.reply.reflection', self::REFLECTION_DAILY_EXAMPLE);

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_SOCRATIC_ENDPOINT)
            && $request['student_id'] === $this->student->id
            && $request['topic'] === self::TOPIC_LINEAR_FUNCTIONS);
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), self::PYTHON_NEXT_ENDPOINT));
    }

    public function test_hybrid_gemini_path_retries_three_times(): void
    {
        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::sequence()
                ->push(['message' => 'busy'], 503)
                ->push(['message' => 'busy'], 503)
                ->push($this->hybridTurn('conectar', self::GUIDANCE_SLOPE)),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', self::GUIDANCE_SLOPE);

        Http::assertSentCount(3);
    }

    public function test_direct_gemini_flash_is_used_when_analytics_is_down(): void
    {
        config([
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-1.5-flash',
            'services.gemini.base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ]);

        Http::fake([
            self::BASE_URL.'/*' => Http::failedConnection(),
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => '¿Qué ejemplo cotidiano tiene una pendiente?']]]],
                ],
            ]),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', '¿Qué ejemplo cotidiano tiene una pendiente?')
            ->assertJsonPath('data.session.create_phase', 'conectar');
    }

    public function test_student_can_publish_create_article_in_session(): void
    {
        Http::fake();
        $session = $this->tutorSession(TutorSession::STATUS_ACTIVE);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'session_id' => $session->id,
                'message' => "[ARTICLE_PUBLISH]\nFase: evaluar\nTítulo: Pendiente en la vida diaria\n---\nLa pendiente mide cuánto cambia y al avanzar x.",
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.type', 'article')
            ->assertJsonPath('data.session.article.title', 'Pendiente en la vida diaria')
            ->assertJsonPath('data.session.article.published', true)
            ->assertJsonPath('data.session.article.create_phase', 'evaluar');

        $this->assertSame('Pendiente en la vida diaria', $session->fresh()->state['article']['title']);
        Http::assertNothingSent();
    }

    public function test_hybrid_mermaid_nodes_with_parentheses_are_quoted(): void
    {
        $reply = $this->hybridTurn('explicar', 'Observa el diagrama.');
        $reply['reply']['diagram_mermaid'] = "flowchart TD\n    A[Inicio (x1, y1)] --> B[Fin]";
        $reply['socratic_response']['diagram_mermaid'] = $reply['reply']['diagram_mermaid'];

        Http::fake([
            self::BASE_URL.self::PYTHON_SOCRATIC_ENDPOINT => Http::response($reply),
            self::BASE_URL.self::PYTHON_NEXT_ENDPOINT => Http::response($this->pythonTurn('pista', 'hint')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('data.reply.diagram_mermaid', "flowchart TD\n    A[\"Inicio (x1, y1)\"] --> B[Fin]");
    }

    public function test_python_down_returns_courtesy_fallback_and_persists(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::failedConnection()]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE)
            ->assertJsonPath('data.reply.text', $this->courtesyText(self::TOPIC_LINEAR_FUNCTIONS));

        $this->assertSame(1, TutorSession::query()->count());
    }

    public function test_access_rules_and_validation(): void
    {
        Http::fake();
        $foreignCourse = Course::factory()->create();
        $classmateUser = $this->userWithRole(Roles::STUDENT);
        Student::factory()->create(['user_id' => $classmateUser->id]);
        $session = $this->tutorSession(TutorSession::STATUS_ACTIVE);
        $finished = $this->tutorSession(TutorSession::STATUS_COMPLETED);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['course_id', 'topic']);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $foreignCourse->id, 'topic' => self::TOPIC_LINEAR_FUNCTIONS])
            ->assertForbidden();

        $this->actingAs($classmateUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['session_id' => $session->id, 'message' => 'hola'])
            ->assertForbidden();

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['session_id' => $finished->id, 'message' => 'hola'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session_id']);

        $this->actingAs($this->userWithRole(Roles::TEACHER), 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'x'])
            ->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_sessions_history_lists_only_own_sessions_with_messages(): void
    {
        $own = $this->tutorSession(TutorSession::STATUS_ACTIVE);
        $own->messages()->create(['role' => 'tutor', 'content' => 'Â¿QuÃ© forma tiene?', 'meta' => ['type' => 'question', 'options' => [['id' => 'a', 'text' => 'Recta']]]]);
        $other = Student::factory()->create();
        TutorSession::query()->create(['student_id' => $other->id, 'course_id' => $this->course->id, 'topic' => 'Ajeno', 'status' => TutorSession::STATUS_ACTIVE]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson(self::ENDPOINT.'/sessions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.id', $own->id)
            ->assertJsonPath('data.0.course_name', $this->course->name)
            ->assertJsonPath('data.0.messages.0.content', 'Â¿QuÃ© forma tiene?')
            ->assertJsonPath('data.0.messages.0.options.0.text', 'Recta');
    }

    public function test_student_deletes_own_session_and_article_draft_without_touching_analytics(): void
    {
        $session = $this->tutorSession(TutorSession::STATUS_ACTIVE);
        $session->forceFill([
            'state' => [
                'step' => 'pista',
                'hint_level' => 1,
                'article' => [
                    'title' => 'Pendiente cotidiana',
                    'body' => 'Borrador del artículo.',
                    'published' => false,
                ],
            ],
        ])->save();
        $session->messages()->create(['role' => TutorMessage::ROLE_TUTOR, 'content' => '¿Qué ya sabes?', 'meta' => null]);
        $session->messages()->create(['role' => TutorMessage::ROLE_STUDENT, 'content' => 'Es una recta.', 'meta' => null]);

        $prediction = RiskPrediction::factory()->create([
            'student_id' => $this->student->id,
            'academic_period_id' => $this->course->academic_period_id,
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->deleteJson(self::DELETE_ENDPOINT.'/'.$session->id)
            ->assertOk()
            ->assertJsonPath('message', 'Sesión eliminada.')
            ->assertJsonPath('data.id', $session->id);

        $this->assertDatabaseMissing('tutor_sessions', ['id' => $session->id]);
        $this->assertDatabaseMissing('tutor_messages', ['tutor_session_id' => $session->id]);
        $this->assertDatabaseHas('risk_predictions', ['id' => $prediction->id]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson(self::ENDPOINT.'/sessions')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_student_cannot_delete_another_students_session(): void
    {
        $other = Student::factory()->create();
        $foreign = TutorSession::query()->create([
            'student_id' => $other->id,
            'course_id' => $this->course->id,
            'topic' => 'Ajeno',
            'status' => TutorSession::STATUS_ACTIVE,
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->deleteJson(self::DELETE_ENDPOINT.'/'.$foreign->id)
            ->assertForbidden();

        $this->assertDatabaseHas('tutor_sessions', ['id' => $foreign->id]);

        $this->actingAs($this->userWithRole(Roles::TEACHER), 'sanctum')
            ->deleteJson(self::DELETE_ENDPOINT.'/'.$foreign->id)
            ->assertForbidden();
    }

    private function courtesyText(string $topic): string
    {
        return "Ahora no pude consultar al tutor de IA. Mientras se restablece, cuéntame con tus palabras qué recuerdas de «{$topic}». ¿Qué parte te resulta más confusa?";
    }

    private function hybridTurn(string $phase, string $text, array $options = [], bool $insufficient = false): array
    {
        $reply = [
            'type' => 'question',
            'text' => $text,
            'create_phase' => $phase,
            'explanation' => $text,
            'reflection' => 'Explica cómo lo pensaste.',
        ];
        if ($options) {
            $reply['options'] = $options;
            $reply['quiz'] = ['question' => $text, 'options' => $options];
        }

        return [
            'insufficient_data' => $insufficient,
            'create_phase' => $phase,
            'done' => false,
            'socratic_response' => [
                'available' => true,
                'guidance' => $text,
                'create_phase' => $phase,
                'explanation' => $text,
            ],
            'reply' => $reply,
        ];
    }

    private function pythonTurn(string $step, string $type, array $options = []): array
    {
        $reply = [
            'type' => $type,
            'text' => "Paso $step",
            'create_phase' => match ($step) {
                'diagnostico' => 'conectar',
                'pregunta_guia' => 'recordar',
                'pista' => 'explicar',
                'verificacion' => 'aplicar',
                'reflexion' => 'transferir',
                default => 'evaluar',
            },
        ];
        if ($options) {
            $reply['options'] = $options;
            $reply['quiz'] = ['question' => "Paso $step", 'options' => $options];
        }

        return [
            'state' => ['version' => 1, 'scaffold_id' => 'mat-funciones-lineales', 'step' => $step, 'hint_level' => 0, 'create_phase' => $reply['create_phase']],
            'step' => $step,
            'hint_level' => 0,
            'reply' => $reply,
            'done' => false,
            'meta' => ['scaffold_id' => 'mat-funciones-lineales', 'subject' => 'MatemÃ¡ticas', 'criterion' => 'A'],
        ];
    }

    private function tutorSession(string $status): TutorSession
    {
        return TutorSession::query()->create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
            'topic' => self::TOPIC_LINEAR_FUNCTIONS,
            'status' => $status,
            'state' => ['version' => 1, 'scaffold_id' => 'mat-funciones-lineales', 'step' => 'pista', 'hint_level' => 1],
        ]);
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);

        return User::factory()->create(['role_id' => $role->id, 'is_active' => true, 'must_change_password' => false]);
    }
}
