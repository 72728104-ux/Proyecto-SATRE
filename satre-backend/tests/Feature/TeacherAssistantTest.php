<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TeacherAssistantTest extends TestCase
{
    use RefreshDatabase;

    private const BASE_URL = 'http://analytics.test';

    private const ENDPOINT = '/api/v1/analytics/teacher-assistant';

    private Classroom $classroom;

    private Student $student;

    private User $teacherUser;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.python_analytics.url' => self::BASE_URL,
            'services.python_analytics.key' => 'test-internal-key',
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-1.5-flash',
            'services.gemini.base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ]);

        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $this->teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $this->teacherUser->id]);
        $this->classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);
        $this->student = Student::factory()->create([
            'classroom_id' => $this->classroom->id,
            'status' => 'active',
        ]);
    }

    public function test_teacher_query_forwards_to_python_hybrid_and_returns_strategies(): void
    {
        Http::fake([
            self::BASE_URL.self::ENDPOINT => Http::response($this->hybridReply()),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'criterion' => 'D',
                'message' => '¿Qué actividades remediales sugieres para la competencia D en este grupo?',
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.engine', 'hybrid')
            ->assertJsonPath('data.reply.criterion_focus', 'D')
            ->assertJsonPath('data.reply.recommended_actions.0', 'Taller de producción con rúbrica D')
            ->assertJsonPath('data.metrics.passing_score', 11);

        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Internal-Key', 'test-internal-key')
            && str_ends_with($request->url(), self::ENDPOINT)
            && $request['classroom_id'] === $this->classroom->id
            && $request['criterion'] === 'D'
            && ! isset($request['name'])
            && ! isset($request['dni']));
    }

    public function test_falls_back_to_gemini_15_flash_with_three_retries(): void
    {
        Http::fake([
            self::BASE_URL.self::ENDPOINT => Http::response('upstream crash', 500),
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' => Http::sequence()
                ->push(['error' => ['message' => 'busy']], 503)
                ->push(['error' => ['message' => 'busy']], 503)
                ->push([
                    'candidates' => [
                        ['content' => ['parts' => [['text' => json_encode([
                            'text' => 'Prioriza talleres remediales del criterio D en escala 0–20.',
                            'summary' => 'Intervención en criterio D',
                            'actions' => ['Rúbrica analítica D'],
                            'materials' => ['Ficha MINEDU'],
                            'criterion_focus' => 'D',
                        ], JSON_UNESCAPED_UNICODE)]]]],
                    ],
                ]),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => '¿Qué actividades remediales sugieres para la competencia D en este grupo?',
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.reply.criterion_focus', 'D')
            ->assertJsonPath('data.reply.recommended_actions.0', 'Rúbrica analítica D');

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'models/gemini-1.5-flash:generateContent')
            && $request->hasHeader('x-goog-api-key', 'test-gemini-key'));
        $this->assertGreaterThanOrEqual(3, collect(Http::recorded())
            ->filter(fn (array $pair) => str_contains($pair[0]->url(), 'gemini-1.5-flash'))
            ->count());
    }

    public function test_returns_200_when_providers_fail(): void
    {
        config(['services.gemini.key' => null]);
        Http::fake([
            self::BASE_URL.self::ENDPOINT => Http::response('crash', 500),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => 'Resume el aula para apoderados.',
            ])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null);
    }

    public function test_student_from_other_classroom_is_forbidden(): void
    {
        Http::fake();
        $other = Student::factory()->create(['status' => 'active']);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'student_id' => $other->id,
                'message' => '¿Cómo está este alumno?',
            ])
            ->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_student_role_cannot_use_teacher_assistant(): void
    {
        Http::fake();
        $studentUser = $this->userWithRole(Roles::STUDENT);
        Student::factory()->create([
            'user_id' => $studentUser->id,
            'classroom_id' => $this->classroom->id,
        ]);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => '¿Cómo va el aula?',
            ])
            ->assertForbidden();
    }

    public function test_specific_student_query_sends_internal_student_id(): void
    {
        Http::fake([
            self::BASE_URL.self::ENDPOINT => Http::response($this->hybridReply('student')),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'student_id' => $this->student->id,
                'message' => 'Sugiere intervenciones para este alumno en riesgo MEDIO.',
            ])
            ->assertOk()
            ->assertJsonPath('available', true);

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), self::ENDPOINT)
            && $request['student_id'] === $this->student->id
            && ! isset($request['first_name'])
            && ! isset($request['student_name']));
    }

    /**
     * @return array<string, mixed>
     */
    private function hybridReply(string $scope = 'classroom'): array
    {
        return [
            'available' => true,
            'insufficient_data' => false,
            'scope' => $scope,
            'deterministic_metrics' => [
                'risk_score' => null,
                'risk_level' => $scope === 'student' ? 'MEDIO' : null,
                'minedu_grade' => $scope === 'student' ? 'B' : null,
                'passing_score' => 11,
                'criteria' => ['A', 'B', 'C', 'D'],
                'top_gaps' => [['criterion' => 'D', 'mean_vigesimal' => 8.0, 'pct_below_passing' => 0.6]],
            ],
            'assistant_response' => [
                'available' => true,
                'text' => 'Para el criterio D, usa rúbricas analíticas y un taller de producción.',
                'summary' => 'Remedial en criterio D (En Inicio)',
                'recommended_actions' => ['Taller de producción con rúbrica D'],
                'suggested_materials' => ['Ficha MINEDU de recuperación'],
                'criterion_focus' => 'D',
            ],
        ];
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(
            ['slug' => $slug],
            ['name' => $slug, 'description' => $slug]
        );

        return User::factory()->create([
            'role_id' => $role->id,
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
