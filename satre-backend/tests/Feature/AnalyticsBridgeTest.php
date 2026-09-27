<?php

namespace Tests\Feature;

use App\Jobs\RunRiskBatchJob;
use App\Models\AcademicPeriod;
use App\Models\AiDiagnostic;
use App\Models\Alert;
use App\Models\Classroom;
use App\Models\Guardian;
use App\Models\RiskPrediction;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AnalyticsBridgeTest extends TestCase
{
    use RefreshDatabase;

    private const BASE_URL = 'http://analytics.test';

    private AcademicPeriod $period;

    private Classroom $classroom;

    private Student $student;

    private User $teacherUser;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.python_analytics.url' => self::BASE_URL,
            'services.python_analytics.key' => 'test-internal-key',
        ]);

        $this->period = AcademicPeriod::factory()->create(['is_current' => true]);
        $this->teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $this->teacherUser->id]);
        $this->classroom = Classroom::factory()->create([
            'academic_period_id' => $this->period->id,
            'tutor_id' => $teacher->id,
        ]);
        $this->student = Student::factory()->create([
            'classroom_id' => $this->classroom->id,
            'status' => 'active',
        ]);
    }

    // --- Insights docente -------------------------------------------------

    public function test_teacher_insights_fetches_python_and_stores_diagnostic(): void
    {
        Http::fake([self::BASE_URL.'/v1/classrooms/*' => Http::response($this->insightsPayload())]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/teacher/insights/{$this->classroom->id}")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('stale', false)
            ->assertJsonPath('data.top_gaps.0.criterion', 'B');

        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Internal-Key', 'test-internal-key')
            && str_contains($request->url(), "/v1/classrooms/{$this->classroom->id}/insights"));

        $this->assertDatabaseHas('ai_diagnostics', [
            'type' => AiDiagnostic::TYPE_TEACHER_INSIGHT,
            'classroom_id' => $this->classroom->id,
            'academic_period_id' => $this->period->id,
        ]);
    }

    public function test_teacher_insights_uses_fresh_cache_without_calling_python(): void
    {
        Http::fake();
        $this->diagnostic(now()->subHours(2));

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/teacher/insights/{$this->classroom->id}")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.cached', true);

        Http::assertNothingSent();
    }

    public function test_teacher_insights_older_than_24h_are_refreshed(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::response($this->insightsPayload())]);
        $this->diagnostic(now()->subHours(25));

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/teacher/insights/{$this->classroom->id}")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonMissingPath('data.cached');

        Http::assertSentCount(1);
        $this->assertSame(1, AiDiagnostic::query()->count());
    }

    public function test_python_500_returns_available_false_with_one_retry(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::response(['message' => 'boom'], 500)]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/teacher/insights/{$this->classroom->id}")
            ->assertOk()
            ->assertExactJson(['available' => false, 'stale' => false, 'generated_at' => null, 'data' => null]);

        Http::assertSentCount(2);
    }

    public function test_python_timeout_returns_available_false_and_keeps_stale_data(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::failedConnection('cURL error 28: Operation timed out')]);
        $this->diagnostic(now()->subDays(3));

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/teacher/insights/{$this->classroom->id}")
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('stale', true)
            ->assertJsonPath('data.cached', true);
    }

    public function test_teacher_cannot_see_insights_of_another_classroom(): void
    {
        Http::fake();
        $other = Classroom::factory()->create(['academic_period_id' => $this->period->id]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/teacher/insights/{$other->id}")
            ->assertForbidden();

        Http::assertNothingSent();
    }

    // --- Riesgo por estudiante --------------------------------------------

    public function test_teacher_sees_full_risk_and_student_sees_reduced_view(): void
    {
        $this->prediction(RiskPrediction::LEVEL_MEDIUM);
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $this->student->update(['user_id' => $studentUser->id]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$this->student->id}/risk")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.risk_level', 'MEDIO')
            ->assertJsonPath('data.factors.0.key', 'unexcused_absence')
            ->assertJsonPath('data.risk_score', 48.2);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$this->student->id}/risk")
            ->assertOk()
            ->assertJsonPath('data.risk_level', 'MEDIO')
            ->assertJsonPath('data.recommendation', 'Monitoreo preventivo.')
            ->assertJsonMissingPath('data.factors')
            ->assertJsonMissingPath('data.risk_score');
    }

    public function test_guardian_sees_reduced_view_only_for_linked_children(): void
    {
        $this->prediction(RiskPrediction::LEVEL_HIGH);
        $guardianUser = $this->userWithRole(Roles::GUARDIAN);
        $guardian = Guardian::query()->create([
            'user_id' => $guardianUser->id,
            'document_number' => '11112222',
            'first_name' => 'Ana',
            'last_name' => 'Rojas',
        ]);
        $other = Student::factory()->create(['classroom_id' => $this->classroom->id]);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$this->student->id}/risk")
            ->assertForbidden();

        $guardian->students()->attach($this->student->id);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$this->student->id}/risk")
            ->assertOk()
            ->assertJsonPath('data.risk_level', 'ALTO')
            ->assertJsonMissingPath('data.factors');

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$other->id}/risk")
            ->assertForbidden();
    }

    public function test_risk_without_prediction_is_200_not_available(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::failedConnection()]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$this->student->id}/risk")
            ->assertOk()
            ->assertExactJson(['available' => false, 'data' => null]);
    }

    public function test_staff_refreshes_stale_classroom_risk_from_python(): void
    {
        $this->fakeBatch(RiskPrediction::LEVEL_MEDIUM);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$this->student->id}/risk")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.risk_level', 'MEDIO')
            ->assertJsonPath('data.factors.0.key', 'unexcused_absence');

        Http::assertSent(fn (Request $request) => $request->url() === self::BASE_URL.'/v1/batch/risk'
            && $request['classroom_id'] === $this->classroom->id);
        $this->assertDatabaseHas('risk_predictions', [
            'student_id' => $this->student->id,
            'risk_level' => 'MEDIO',
        ]);
    }

    public function test_student_reads_cached_risk_without_calling_python(): void
    {
        Http::fake();
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $this->student->update(['user_id' => $studentUser->id]);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/ai-analytics/students/{$this->student->id}/risk")
            ->assertOk()
            ->assertExactJson(['available' => false, 'data' => null]);

        Http::assertNothingSent();
    }

    // --- Batch nocturno y alertas -----------------------------------------

    public function test_batch_stores_predictions_diagnostics_and_creates_high_alert(): void
    {
        $this->fakeBatch(RiskPrediction::LEVEL_HIGH);

        RunRiskBatchJob::dispatchSync();

        Http::assertSent(fn (Request $request) => $request->url() === self::BASE_URL.'/v1/batch/risk'
            && $request['period_id'] === $this->period->id);

        $this->assertDatabaseHas('risk_predictions', [
            'student_id' => $this->student->id,
            'academic_period_id' => $this->period->id,
            'risk_level' => 'ALTO',
        ]);
        $this->assertDatabaseHas('ai_diagnostics', ['type' => AiDiagnostic::TYPE_STUDENT_PROFILE, 'student_id' => $this->student->id]);
        $this->assertDatabaseHas('ai_diagnostics', ['type' => AiDiagnostic::TYPE_TEACHER_INSIGHT, 'classroom_id' => $this->classroom->id]);
        $this->assertDatabaseHas('alerts', [
            'student_id' => $this->student->id,
            'type' => Alert::TYPE_RISK,
            'severity' => 'ALTO',
            'status' => 'open',
        ]);
    }

    public function test_medium_or_insufficient_risk_does_not_create_alert(): void
    {
        $this->fakeBatch(RiskPrediction::LEVEL_MEDIUM);

        RunRiskBatchJob::dispatchSync();

        $this->assertSame(1, RiskPrediction::query()->count());
        $this->assertSame(0, Alert::query()->count());
    }

    public function test_repeated_high_risk_does_not_duplicate_open_alert(): void
    {
        $this->fakeBatch(RiskPrediction::LEVEL_HIGH);

        RunRiskBatchJob::dispatchSync();
        RunRiskBatchJob::dispatchSync();

        $this->assertSame(2, RiskPrediction::query()->count());
        $this->assertSame(1, Alert::query()->count());
        $this->assertSame(
            RiskPrediction::query()->latest('id')->value('id'),
            Alert::query()->value('risk_prediction_id'),
        );
    }

    public function test_resolved_alert_allows_a_new_one(): void
    {
        Alert::query()->create([
            'student_id' => $this->student->id,
            'type' => Alert::TYPE_RISK,
            'severity' => 'ALTO',
            'title' => 'Anterior',
            'message' => 'Anterior',
            'status' => 'resolved',
        ]);
        $this->fakeBatch(RiskPrediction::LEVEL_HIGH);

        RunRiskBatchJob::dispatchSync();

        $this->assertSame(2, Alert::query()->count());
        $this->assertSame(1, Alert::query()->open()->count());
    }

    public function test_medium_to_high_escalates_existing_alert_instead_of_duplicating(): void
    {
        $alert = Alert::query()->create([
            'student_id' => $this->student->id,
            'type' => Alert::TYPE_RISK,
            'severity' => 'MEDIO',
            'title' => 'Riesgo MEDIO',
            'message' => 'Seguimiento preventivo',
            'status' => 'acknowledged',
        ]);
        $this->fakeBatch(RiskPrediction::LEVEL_HIGH);

        RunRiskBatchJob::dispatchSync();

        $this->assertSame(1, Alert::query()->count());
        $alert->refresh();
        $this->assertSame('ALTO', $alert->severity);
        $this->assertSame('acknowledged', $alert->status);
        $this->assertNotNull($alert->risk_prediction_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'alert.escalated', 'auditable_id' => $alert->id]);
    }

    public function test_batch_with_python_down_does_not_throw_or_store(): void
    {
        Http::fake([self::BASE_URL.'/*' => Http::failedConnection()]);

        RunRiskBatchJob::dispatchSync();

        $this->assertSame(0, RiskPrediction::query()->count());
        $this->assertSame(0, AiDiagnostic::query()->count());
    }

    public function test_batch_falls_back_to_one_by_one_when_endpoint_missing(): void
    {
        Http::fake([
            self::BASE_URL.'/v1/batch/risk' => Http::response(['message' => 'Not Found'], 404),
            self::BASE_URL.'/v1/students/*' => Http::response($this->riskPayload(RiskPrediction::LEVEL_HIGH)),
            self::BASE_URL.'/v1/classrooms/*' => Http::response($this->insightsPayload()),
        ]);

        RunRiskBatchJob::dispatchSync();

        Http::assertSent(fn (Request $request) => str_contains($request->url(), "/v1/students/{$this->student->id}/risk"));
        $this->assertSame(1, RiskPrediction::query()->count());
        $this->assertSame(1, Alert::query()->count());
    }

    public function test_risk_batch_is_scheduled_daily_at_2am_lima(): void
    {
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($event) => $event->description === 'risk-batch');

        $this->assertNotNull($event);
        $this->assertSame('0 2 * * *', $event->expression);
        $this->assertSame('America/Lima', $event->timezone);
    }

    // --- Helpers ------------------------------------------------------------

    private function fakeBatch(string $level): void
    {
        Http::fake([
            self::BASE_URL.'/v1/batch/risk' => Http::response([
                'period_id' => $this->period->id,
                'classroom_id' => null,
                'model_version' => 'rules-1.0',
                'count' => 1,
                'results' => [$this->riskPayload($level)],
            ]),
            self::BASE_URL.'/v1/classrooms/*' => Http::response($this->insightsPayload()),
        ]);
    }

    private function riskPayload(string $level): array
    {
        return [
            'student_id' => $this->student->id,
            'period_id' => $this->period->id,
            'model_version' => 'rules-1.0',
            'insufficient_data' => false,
            'data_coverage' => 0.9,
            'risk_level' => $level,
            'risk_score' => $level === RiskPrediction::LEVEL_HIGH ? 72.5 : 48.2,
            'factors' => [['key' => 'unexcused_absence', 'label' => 'Inasistencias injustificadas', 'value' => 0.12, 'contribution' => 15.0]],
            'recommendation' => 'Intervención prioritaria.',
            'needs_human_review' => false,
            'profile_cluster' => null,
        ];
    }

    private function insightsPayload(): array
    {
        return [
            'classroom_id' => $this->classroom->id,
            'period_id' => $this->period->id,
            'model_version' => 'rules-1.0',
            'generated_at' => now()->toIso8601String(),
            'insufficient_data' => false,
            'courses' => [],
            'top_gaps' => [['criterion' => 'B', 'below_4_pct' => 0.4]],
            'error_matrix' => [],
        ];
    }

    private function diagnostic($generatedAt): AiDiagnostic
    {
        return AiDiagnostic::query()->create([
            'type' => AiDiagnostic::TYPE_TEACHER_INSIGHT,
            'classroom_id' => $this->classroom->id,
            'academic_period_id' => $this->period->id,
            'payload' => ['cached' => true, 'top_gaps' => []],
            'model_version' => 'rules-1.0',
            'generated_at' => $generatedAt,
        ]);
    }

    private function prediction(string $level): RiskPrediction
    {
        return RiskPrediction::query()->create([
            'student_id' => $this->student->id,
            'academic_period_id' => $this->period->id,
            'risk_level' => $level,
            'risk_score' => 48.2,
            'factors' => [['key' => 'unexcused_absence', 'label' => 'Inasistencias injustificadas', 'value' => 0.12, 'contribution' => 15.0]],
            'data_coverage' => 0.9,
            'recommendation' => 'Monitoreo preventivo.',
            'model_version' => 'rules-1.0',
            'predicted_at' => now(),
        ]);
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
