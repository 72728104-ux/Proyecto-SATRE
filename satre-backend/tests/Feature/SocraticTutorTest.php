<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\Student;
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
            self::BASE_URL.'/api/v1/analytics/socratic-tutor' => Http::response($this->hybridTurn('conectar', '¿Qué forma tiene el gráfico?', [
                ['id' => 'a', 'text' => 'Una recta'],
                ['id' => 'b', 'text' => 'Una parábola'],
            ])),
            self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
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
            && str_ends_with($request->url(), '/api/v1/analytics/socratic-tutor')
            && $request['student_id'] === $this->student->id
            && $request['topic'] === 'Funciones lineales'
            && $request['user_message'] === 'Funciones lineales');
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next'));

        $session = TutorSession::query()->sole();
        $this->assertSame('conectar', $session->state['create_phase']);
        $this->assertSame(['student', 'tutor'], $session->messages()->pluck('role')->all());
    }

    public function test_student_starts_session_preloading_ib_criterion(): void
    {
        Http::fake([
            self::BASE_URL.'/api/v1/analytics/socratic-tutor' => Http::response($this->hybridTurn('conectar', '¿Qué recuerdas de la fotosíntesis?')),
            self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'course_id' => $this->course->id,
                'topic' => 'Fotosíntesis',
                'criterion' => 'B',
            ])
            ->assertOk()
            ->assertJsonPath('data.session.topic', 'Fotosíntesis')
            ->assertJsonPath('data.session.criterion', 'B');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/api/v1/analytics/socratic-tutor')
            && $request['topic'] === 'Fotosíntesis'
            && ($request['criterion'] ?? null) === 'B');
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next'));

        $this->assertSame('B', TutorSession::query()->sole()->criterion);
    }

    public function test_invalid_ib_criterion_is_rejected(): void
    {
        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'course_id' => $this->course->id,
                'topic' => 'Fotosíntesis',
                'criterion' => 'E',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['criterion']);
    }

    public function test_follow_up_turn_forwards_state_and_stores_chosen_option_text(): void
    {
        Http::fake([
            self::BASE_URL.'/api/v1/analytics/socratic-tutor' => Http::sequence()
                ->push($this->hybridTurn('conectar', '¿Qué forma tiene?', [['id' => 'a', 'text' => 'Una recta']]))
                ->push($this->hybridTurn('recordar', '¿Qué es la pendiente?')),
            self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('pregunta_guia', 'question')),
        ]);

        $sessionId = $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->json('data.session.id');

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['session_id' => $sessionId, 'option_id' => 'a'])
            ->assertOk()
            ->assertJsonPath('data.session.id', $sessionId)
            ->assertJsonPath('data.session.create_phase', 'recordar')
            ->assertJsonPath('data.session.step', 'pregunta_guia');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/api/v1/analytics/socratic-tutor')
            && $request['user_message'] === 'Una recta');
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next'));

        $this->assertDatabaseHas('tutor_messages', ['tutor_session_id' => $sessionId, 'role' => 'student', 'content' => 'Una recta']);
        $this->assertSame(4, TutorSession::query()->find($sessionId)->messages()->count());
    }

    public function test_student_misconception_is_forwarded_to_gemini_without_catalog(): void
    {
        Http::fake([
            self::BASE_URL.'/api/v1/analytics/socratic-tutor' => Http::sequence()
                ->push($this->hybridTurn('conectar', '¿Qué es la pendiente de una recta?'))
                ->push($this->hybridTurn('explicar', 'La pendiente no es el eje. ¿Qué cambia en y cuando aumenta x?')),
            self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('pista', 'hint')),
        ]);

        $sessionId = $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Pendiente'])
            ->json('data.session.id');

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['session_id' => $sessionId, 'message' => 'el eje'])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', 'La pendiente no es el eje. ¿Qué cambia en y cuando aumenta x?');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/api/v1/analytics/socratic-tutor')
            && $request['user_message'] === 'el eje');
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next'));
    }

    public function test_gemini_failure_is_reported_without_catalog_fallback(): void
    {
        Http::fake([
            self::BASE_URL.'/api/v1/analytics/socratic-tutor' => Http::response([
                'insufficient_data' => false,
                'socratic_response' => [
                    'available' => false,
                    'reason' => 'quota_exhausted',
                    'message' => 'La cuota de la API de IA está agotada.',
                ],
            ]),
            self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('diagnostico', 'question', [
                ['id' => 'a', 'text' => 'Pista 1: Piensa en cuánto sube'],
            ])),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null)
            ->assertJsonPath('reason', 'quota_exhausted')
            ->assertJsonPath('message', 'La cuota de la API de IA está agotada.');

        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next'));
        $this->assertSame(0, TutorSession::query()->count());
    }

    public function test_tutor_chat_alias_forwards_to_python_and_persists(): void
    {
        Http::fake([
            self::BASE_URL.'/api/v1/analytics/socratic-tutor' => Http::response($this->hybridTurn('conectar', '¿Qué ya sabes de la pendiente?', [
                ['id' => 'a', 'text' => 'Una recta'],
            ])),
            self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson('/api/v1/tutor/chat', ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.type', 'question')
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE);

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/api/v1/analytics/socratic-tutor')
            && $request['topic'] === 'Funciones lineales'
            && $request->hasHeader('X-Internal-Key', 'test-internal-key'));
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next'));
        $this->assertSame(1, TutorSession::query()->count());
        $this->assertSame(['student', 'tutor'], TutorSession::query()->sole()->messages()->pluck('role')->all());
    }

    public function test_hybrid_create_reply_is_used_when_gemini_available(): void
    {
        Http::fake([
            self::BASE_URL.'/api/v1/analytics/socratic-tutor' => Http::response([
                'insufficient_data' => false,
                'create_phase' => 'conectar',
                'done' => false,
                'socratic_response' => [
                    'available' => true,
                    'guidance' => '¿Qué ya sabes de la pendiente?',
                    'create_phase' => 'conectar',
                    'explanation' => '¿Qué ya sabes de la pendiente?',
                    'reflection' => 'Escribe un ejemplo de tu vida diaria.',
                    'quiz' => [
                        'question' => 'La pendiente describe…',
                        'options' => [
                            ['id' => 'a', 'text' => 'Un corte con el eje y'],
                            ['id' => 'b', 'text' => 'Cuánto cambia y al aumentar x'],
                        ],
                    ],
                    'diagram_mermaid' => "flowchart TD\n    A[Δy] --> M[pendiente]",
                    'visual_resource' => ['title' => 'Recta', 'description' => 'Sube al avanzar'],
                ],
                'reply' => [
                    'type' => 'question',
                    'text' => "¿Qué ya sabes de la pendiente?\n\nEscribe un ejemplo de tu vida diaria.",
                    'create_phase' => 'conectar',
                    'explanation' => '¿Qué ya sabes de la pendiente?',
                    'reflection' => 'Escribe un ejemplo de tu vida diaria.',
                    'quiz' => [
                        'question' => 'La pendiente describe…',
                        'options' => [
                            ['id' => 'a', 'text' => 'Un corte con el eje y'],
                            ['id' => 'b', 'text' => 'Cuánto cambia y al aumentar x'],
                        ],
                    ],
                    'diagram_mermaid' => "flowchart TD\n    A[Δy] --> M[pendiente]",
                    'options' => [
                        ['id' => 'a', 'text' => 'Un corte con el eje y'],
                        ['id' => 'b', 'text' => 'Cuánto cambia y al aumentar x'],
                    ],
                ],
            ]),
            self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('diagnostico', 'question')),
        ]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.session.create_phase', 'conectar')
            ->assertJsonPath('data.reply.create_phase', 'conectar')
            ->assertJsonPath('data.reply.quiz.options.1.text', 'Cuánto cambia y al aumentar x')
            ->assertJsonPath('data.reply.diagram_mermaid', "flowchart TD\n    A[Δy] --> M[pendiente]")
            ->assertJsonPath('data.reply.reflection', 'Escribe un ejemplo de tu vida diaria.');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/api/v1/analytics/socratic-tutor')
            && $request['student_id'] === $this->student->id
            && $request['topic'] === 'Funciones lineales');
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next'));
    }

    public function test_python_down_returns_200_unavailable_without_storing(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::failedConnection()]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null);

        $this->assertSame(0, TutorSession::query()->count());
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
            ->postJson(self::ENDPOINT, ['course_id' => $foreignCourse->id, 'topic' => 'Funciones lineales'])
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

    private function hybridTurn(string $phase, string $text, array $options = []): array
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
            'insufficient_data' => false,
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
            'topic' => 'Funciones lineales',
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
