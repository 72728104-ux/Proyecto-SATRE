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
 * §4.6 puente Laravel → satre-analytics /v1/socratic/next (§5.5).
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
        Http::fake([self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('diagnostico', 'question', [
            ['id' => 'a', 'text' => 'Una recta'],
            ['id' => 'b', 'text' => 'Una parÃ¡bola'],
        ]))]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE)
            ->assertJsonPath('data.session.criterion', 'A')
            ->assertJsonPath('data.session.step', 'diagnostico')
            ->assertJsonPath('data.reply.type', 'question')
            ->assertJsonPath('data.reply.options.1.text', 'Una parÃ¡bola')
            ->assertJsonPath('data.done', false)
            ->assertJsonMissingPath('data.session.state');

        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Internal-Key', 'test-internal-key')
            && $request['topic'] === 'Funciones lineales'
            && $request['state'] === null);

        $session = TutorSession::query()->sole();
        $this->assertSame('diagnostico', $session->state['step']);
        $this->assertSame(['student', 'tutor'], $session->messages()->pluck('role')->all());
    }

    public function test_follow_up_turn_forwards_state_and_stores_chosen_option_text(): void
    {
        Http::fakeSequence(self::BASE_URL.'/v1/socratic/next')
            ->push($this->pythonTurn('diagnostico', 'question', [['id' => 'a', 'text' => 'Una recta']]))
            ->push($this->pythonTurn('pregunta_guia', 'question'));

        $sessionId = $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->json('data.session.id');

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['session_id' => $sessionId, 'option_id' => 'a'])
            ->assertOk()
            ->assertJsonPath('data.session.id', $sessionId)
            ->assertJsonPath('data.session.step', 'pregunta_guia');

        Http::assertSent(fn (Request $request) => $request['option_id'] === 'a'
            && ($request['state']['step'] ?? null) === 'diagnostico');

        $this->assertDatabaseHas('tutor_messages', ['tutor_session_id' => $sessionId, 'role' => 'student', 'content' => 'Una recta']);
        $this->assertSame(4, TutorSession::query()->find($sessionId)->messages()->count());
    }

    public function test_topic_without_catalog_closes_session_as_no_catalog(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::response([
            'state' => null,
            'step' => 'finalizado',
            'hint_level' => 0,
            'reply' => ['type' => 'no_catalog', 'text' => 'AÃºn no tengo una guÃ­a para ese tema.'],
            'done' => true,
            'meta' => ['scaffold_id' => null],
        ])]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'TermodinÃ¡mica'])
            ->assertOk()
            ->assertJsonPath('data.done', true)
            ->assertJsonPath('data.session.status', TutorSession::STATUS_NO_CATALOG);
    }

    public function test_tutor_chat_alias_forwards_to_python_and_persists(): void
    {
        Http::fake([self::BASE_URL.'/v1/socratic/next' => Http::response($this->pythonTurn('diagnostico', 'question', [
            ['id' => 'a', 'text' => 'Una recta'],
        ]))]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson('/api/v1/tutor/chat', ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.type', 'question')
            ->assertJsonPath('data.session.status', TutorSession::STATUS_ACTIVE);

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/v1/socratic/next')
            && $request['topic'] === 'Funciones lineales');
        $this->assertSame(1, TutorSession::query()->count());
        $this->assertSame(['student', 'tutor'], TutorSession::query()->sole()->messages()->pluck('role')->all());
    }

    public function test_python_down_returns_200_unavailable_without_storing(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::failedConnection()]);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, ['course_id' => $this->course->id, 'topic' => 'Funciones lineales'])
            ->assertOk()
            ->assertExactJson(['available' => false, 'data' => null]);

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

    private function pythonTurn(string $step, string $type, array $options = []): array
    {
        $reply = ['type' => $type, 'text' => "Paso $step"];
        if ($options) {
            $reply['options'] = $options;
        }

        return [
            'state' => ['version' => 1, 'scaffold_id' => 'mat-funciones-lineales', 'step' => $step, 'hint_level' => 0],
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
