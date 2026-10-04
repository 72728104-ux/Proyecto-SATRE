<?php

namespace Tests\Feature;

use App\Events\GradeRecorded;
use App\Events\IncidentRecorded;
use App\Jobs\EvaluateStudentRiskJob;
use App\Jobs\RunRiskBatchJob;
use App\Models\AcademicPeriod;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\PermissionRequest;
use App\Models\Role;
use App\Models\Student;
use App\Models\StudentFeatureSnapshot;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class AcademicTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_records_ib_grade_and_update_audits_old_and_new_values(): void
    {
        $context = $this->academicContext();

        $gradeId = $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/academic/grades', $this->gradePayload($context))
            ->assertCreated()
            ->assertJsonPath('data.score', 5)
            ->assertJsonPath('data.criterion', 'B')
            ->assertJsonPath('data.max_score', Grade::MAX_SCORE)
            ->json('data.id');

        $created = AuditLog::query()->where('action', 'grade.recorded')->firstOrFail();
        $this->assertSame([], $created->old_values ?? []);
        $this->assertEquals(5, $created->new_values['score']);
        $this->assertSame('B', $created->new_values['criterion']);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->putJson("/api/academic/grades/$gradeId", ['score' => 6, 'criterion' => 'C'])
            ->assertOk()
            ->assertJsonPath('data.score', 6)
            ->assertJsonPath('data.criterion', 'C');

        $updated = AuditLog::query()->where('action', 'grade.updated')->firstOrFail();
        $this->assertEquals(5, $updated->old_values['score']);
        $this->assertEquals(6, $updated->new_values['score']);
        $this->assertSame('B', $updated->old_values['criterion']);
        $this->assertSame('C', $updated->new_values['criterion']);
        $this->assertNotNull($updated->ip_address);
        $this->assertSame($context['teacherUser']->id, $updated->user_id);
    }

    public function test_grade_validates_ib_scale_and_criteria_a_to_d(): void
    {
        $context = $this->academicContext();

        foreach ([0, 8, 4.5, 20] as $score) {
            $this->actingAs($context['teacherUser'], 'sanctum')
                ->postJson('/api/academic/grades', ['score' => $score] + $this->gradePayload($context))
                ->assertStatus(422)
                ->assertJsonValidationErrors(['score']);
        }

        foreach (['E', 'a', '1'] as $criterion) {
            $this->actingAs($context['teacherUser'], 'sanctum')
                ->postJson('/api/academic/grades', ['criterion' => $criterion] + $this->gradePayload($context))
                ->assertStatus(422)
                ->assertJsonValidationErrors(['criterion']);
        }

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/academic/grades', ['evaluation_name' => ''] + $this->gradePayload($context))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['evaluation_name']);

        $this->actingAs($this->userWithRole(Roles::ADMIN), 'sanctum')
            ->postJson('/api/academic/grades', $this->gradePayload($context))
            ->assertForbidden();
    }

    public function test_recording_grade_dispatches_event_without_computing_risk(): void
    {
        Queue::fake();
        $context = $this->academicContext();
        $seen = 0;
        Event::listen(GradeRecorded::class, function () use (&$seen) {
            $seen++;
        });

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/academic/grades', $this->gradePayload($context))
            ->assertCreated();

        $this->assertSame(1, $seen);
        $this->assertSame(0, StudentFeatureSnapshot::query()->count());
        Queue::assertNotPushed(EvaluateStudentRiskJob::class);
        Queue::assertNotPushed(RunRiskBatchJob::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'grade.recorded']);
    }

    public function test_recording_incident_dispatches_event_without_computing_risk(): void
    {
        Queue::fake();
        $context = $this->academicContext();
        $monitor = $this->userWithRole(Roles::MONITOR);
        $seen = 0;
        Event::listen(IncidentRecorded::class, function () use (&$seen) {
            $seen++;
        });

        $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/academic/incidents', [
                'student_id' => $context['student']->id,
                'incident_at' => '2026-04-15 21:30:00',
                'category' => 'conducta',
                'severity' => 'leve',
                'description' => 'Llegó fuera de horario.',
            ])
            ->assertCreated();

        $this->assertSame(1, $seen);
        $this->assertSame(0, StudentFeatureSnapshot::query()->count());
        Queue::assertNotPushed(EvaluateStudentRiskJob::class);
        Queue::assertNotPushed(RunRiskBatchJob::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'incident.recorded']);
    }

    public function test_attendance_store_and_update_are_audited(): void
    {
        $context = $this->academicContext();
        $payload = [
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'attendance_date' => '2026-04-15',
            'status' => 'present',
        ];

        $attendanceId = $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/academic/attendances', $payload)
            ->assertCreated()
            ->assertJsonPath('data.status', 'present')
            ->json('data.id');

        $created = AuditLog::query()->where('action', 'attendance.recorded')->firstOrFail();
        $this->assertSame([], $created->old_values ?? []);
        $this->assertSame('present', $created->new_values['status']);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->putJson("/api/academic/attendances/$attendanceId", ['status' => 'late'])
            ->assertOk()
            ->assertJsonPath('data.status', 'late');

        $updated = AuditLog::query()->where('action', 'attendance.updated')->firstOrFail();
        $this->assertSame('present', $updated->old_values['status']);
        $this->assertSame('late', $updated->new_values['status']);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/academic/attendances', ['status' => 'inventado'] + $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_attendance_session_put_records_previous_status(): void
    {
        $context = $this->academicContext();
        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => '2026-04-15',
            'status' => 'present',
            'recorded_by' => $context['teacherUser']->id,
        ]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->putJson('/api/academic/attendances/session', [
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-04-15',
                'records' => [
                    ['student_id' => $context['student']->id, 'status' => 'absent_unjustified'],
                ],
            ])
            ->assertOk();

        $log = AuditLog::query()->where('action', 'attendance.session_recorded')->firstOrFail();
        $this->assertSame('present', $log->old_values['status']);
        $this->assertSame('absent_unjustified', $log->new_values['status']);
    }

    public function test_presence_incident_and_permission_mutations_are_audited(): void
    {
        $context = $this->academicContext();
        $monitor = $this->userWithRole(Roles::MONITOR);
        [$studentUser, $guardianUser] = $this->studentWithGuardian($context['student']);

        $presenceId = $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/academic/presences', [
                'student_id' => $context['student']->id,
                'presence_date' => '2026-04-15',
                'check_type' => 'night',
                'status' => 'present',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($monitor, 'sanctum')
            ->putJson("/api/academic/presences/$presenceId", ['status' => 'absent'])
            ->assertOk();

        $presenceLog = AuditLog::query()->where('action', 'presence.updated')->firstOrFail();
        $this->assertSame('present', $presenceLog->old_values['status']);
        $this->assertSame('absent', $presenceLog->new_values['status']);

        $incidentId = $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/academic/incidents', [
                'student_id' => $context['student']->id,
                'incident_at' => '2026-04-15 21:30:00',
                'category' => 'salud',
                'severity' => 'leve',
                'description' => 'Dolor de cabeza.',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($monitor, 'sanctum')
            ->putJson("/api/academic/incidents/$incidentId", ['severity' => 'moderada'])
            ->assertOk();

        $incidentLog = AuditLog::query()->where('action', 'incident.updated')->firstOrFail();
        $this->assertSame('leve', $incidentLog->old_values['severity']);
        $this->assertSame('moderada', $incidentLog->new_values['severity']);

        $this->actingAs($monitor, 'sanctum')
            ->getJson('/api/academic/incidents')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'incident.health_viewed',
            'auditable_id' => $incidentId,
        ]);

        $permissionId = $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/academic/permissions', [
                'type' => 'salida',
                'reason' => 'Cita médica',
                'starts_at' => '2026-04-18 08:00:00',
                'ends_at' => '2026-04-18 18:00:00',
            ])
            ->assertCreated()
            ->json('data.id');

        $requested = AuditLog::query()->where('action', 'permission.requested')->firstOrFail();
        $this->assertSame([], $requested->old_values ?? []);
        $this->assertSame(PermissionRequest::STATUS_PENDING_GUARDIAN, $requested->new_values['status']);

        $this->actingAs($guardianUser, 'sanctum')
            ->patchJson("/api/academic/permissions/$permissionId/guardian", ['decision' => 'approved'])
            ->assertOk();

        $guardianLog = AuditLog::query()->where('action', 'permission.guardian_responded')->firstOrFail();
        $this->assertSame(PermissionRequest::STATUS_PENDING_GUARDIAN, $guardianLog->old_values['status']);
        $this->assertSame(PermissionRequest::STATUS_APPROVED_GUARDIAN, $guardianLog->new_values['status']);

        $this->actingAs($monitor, 'sanctum')
            ->patchJson("/api/academic/permissions/$permissionId/resolve", ['decision' => 'approved'])
            ->assertOk();

        $resolved = AuditLog::query()->where('action', 'permission.resolved')->firstOrFail();
        $this->assertSame(PermissionRequest::STATUS_APPROVED_GUARDIAN, $resolved->old_values['status']);
        $this->assertSame(PermissionRequest::STATUS_APPROVED, $resolved->new_values['status']);
    }

    /**
     * @return array<string, mixed>
     */
    private function gradePayload(array $context): array
    {
        return [
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'evaluation_name' => 'Prueba 1',
            'criterion' => 'B',
            'evaluation_date' => '2026-04-15',
            'score' => 5,
        ];
    }

    /**
     * @return array{User, User}
     */
    private function studentWithGuardian(Student $student): array
    {
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student->update(['user_id' => $studentUser->id]);

        $guardianUser = $this->userWithRole(Roles::GUARDIAN);
        $guardian = Guardian::query()->create([
            'user_id' => $guardianUser->id,
            'document_number' => '10101010',
            'first_name' => 'Héctor',
            'last_name' => 'Chávez',
        ]);
        $guardian->students()->attach($student->id, ['relationship' => 'padre', 'is_primary' => true]);

        return [$studentUser, $guardianUser];
    }

    /**
     * @return array{teacherUser: User, student: Student, course: Course, classroom: Classroom, period: AcademicPeriod}
     */
    private function academicContext(): array
    {
        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);
        $student = Student::factory()->create(['classroom_id' => $classroom->id]);
        $course = Course::factory()->create([
            'classroom_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'academic_period_id' => $period->id,
        ]);
        Enrollment::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
        ]);

        return compact('teacherUser', 'student', 'course', 'classroom', 'period');
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
        ]);
    }
}
