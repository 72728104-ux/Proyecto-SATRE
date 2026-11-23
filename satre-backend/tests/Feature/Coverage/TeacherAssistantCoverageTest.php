<?php

namespace Tests\Feature\Coverage;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\RiskPrediction;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Services\PythonAnalyticsClient;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use RuntimeException;
use Tests\TestCase;

/**
 * Cubre métricas locales, prompt con estudiante/historial y fallback de
 * excepciones del asistente docente.
 */
class TeacherAssistantCoverageTest extends TestCase
{
    use RefreshDatabase;

    private const BASE_URL = 'http://analytics.test';

    private const ASSISTANT_ENDPOINT = '/api/v1/analytics/teacher-assistant';

    private const INSIGHTS_PATTERN = self::BASE_URL.'/v1/classrooms/*/insights';

    private const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    private Classroom $classroom;

    private Student $student;

    private User $teacherUser;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.python_analytics.url' => self::BASE_URL,
            'services.python_analytics.key' => 'test-internal-key',
            'services.gemini.key' => null,
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
        RiskPrediction::factory()->create([
            'student_id' => $this->student->id,
            'academic_period_id' => $period->id,
            'risk_level' => RiskPrediction::LEVEL_MEDIUM,
            'risk_score' => 42.5,
        ]);
    }

    public function test_local_metrics_filter_gaps_and_sanitize_reply_lists(): void
    {
        Http::fake([
            self::BASE_URL.self::ASSISTANT_ENDPOINT => Http::response([
                'insufficient_data' => true,
                'assistant_response' => [
                    'available' => true,
                    'text' => 'Usa talleres diferenciados.',
                    'summary' => null,
                    'actions' => 'no-es-una-lista',
                    'materials' => ['  ', 'Ficha de refuerzo'],
                    'criterion_focus' => 'Z',
                ],
            ]),
            self::INSIGHTS_PATTERN => Http::response($this->insightsPayload()),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'student_id' => $this->student->id,
                'criterion' => 'A',
                'message' => '¿Qué brechas priorizo?',
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.engine', 'hybrid')
            ->assertJsonPath('data.insufficient_data', true)
            ->assertJsonPath('data.reply.text', 'Usa talleres diferenciados.')
            ->assertJsonPath('data.reply.criterion_focus', null)
            ->assertJsonPath('data.reply.recommended_actions', [])
            ->assertJsonPath('data.reply.suggested_materials.0', 'Ficha de refuerzo')
            ->assertJsonPath('data.metrics.risk_level', RiskPrediction::LEVEL_MEDIUM)
            ->assertJsonPath('data.metrics.risk_score', '42.50')
            ->assertJsonCount(1, 'data.metrics.top_gaps')
            ->assertJsonPath('data.metrics.top_gaps.0.criterion', 'A')
            ->assertJsonPath('data.metrics.top_gaps.0.mean_vigesimal', 9.5);
    }

    public function test_gemini_plain_text_fallback_builds_prompt_with_student_and_history(): void
    {
        config(['services.gemini.key' => 'test-gemini-key']);

        Http::fake([
            self::BASE_URL.self::ASSISTANT_ENDPOINT => Http::response('crash', 500),
            self::INSIGHTS_PATTERN => Http::response($this->insightsPayload()),
            self::GEMINI_ENDPOINT => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => 'Consejo directo para el aula.']]]],
                ],
            ]),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'student_id' => $this->student->id,
                'criterion' => 'b',
                'message' => 'Resume el caso.',
                'history' => [
                    ['role' => 'assistant', 'content' => 'Hola'],
                    'entrada-invalida',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.reply.text', 'Consejo directo para el aula.')
            ->assertJsonPath('data.reply.summary', null)
            ->assertJsonPath('data.reply.criterion_focus', 'B')
            ->assertJsonPath('data.metrics.top_gaps.0.criterion', 'B');

        Http::assertSent(fn ($request) => str_contains($request->url(), 'models/gemini-1.5-flash:generateContent')
            && str_contains((string) ($request['contents'][0]['parts'][0]['text'] ?? ''), 'Historial reciente')
            && str_contains((string) ($request['contents'][0]['parts'][0]['text'] ?? ''), 'entrada-invalida') === false);
    }

    public function test_unusable_or_missing_assistant_response_falls_back_with_reason(): void
    {
        Http::fake([
            self::BASE_URL.self::ASSISTANT_ENDPOINT => Http::sequence()
                ->push([
                    'assistant_response' => [
                        'available' => false,
                        'reason' => 'quota_exhausted',
                        'message' => 'Cuota agotada',
                    ],
                ])
                ->push([
                    'assistant_response' => 'respuesta-no-array',
                    'reason' => 'api_error',
                ]),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => 'Primera consulta',
            ])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null)
            ->assertJsonPath('reason', 'quota_exhausted');

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => 'Segunda consulta',
            ])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('reason', 'api_error');
    }

    public function test_python_client_exception_uses_gemini_fallback(): void
    {
        config(['services.gemini.key' => 'test-gemini-key']);

        $client = Mockery::mock(PythonAnalyticsClient::class);
        $client->shouldReceive('teacherAssistant')->once()->andThrow(new RuntimeException('boom'));
        $client->shouldReceive('classroomInsights')->andReturn(['available' => false, 'data' => null]);
        $this->app->instance(PythonAnalyticsClient::class, $client);

        Http::fake([
            self::GEMINI_ENDPOINT => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => 'Plan remedial sugerido.']]]],
                ],
            ]),
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => '¿Cómo intervenimos?',
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.reply.text', 'Plan remedial sugerido.');
    }

    /**
     * @return array<string, mixed>
     */
    private function insightsPayload(): array
    {
        return [
            'classroom_id' => $this->classroom->id,
            'model_version' => 'rules-1.0',
            'insufficient_data' => false,
            'courses' => [
                'curso-invalido',
                ['criteria' => ['A' => 15.5, 'B' => 11.0]],
            ],
            'top_gaps' => [
                'brecha-invalida',
                ['criterion' => 'A', 'mean' => 9.5, 'pct_below_4' => 0.55],
                ['criterion' => 'B', 'mean' => 7.0, 'pct_below_4' => 0.8],
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
