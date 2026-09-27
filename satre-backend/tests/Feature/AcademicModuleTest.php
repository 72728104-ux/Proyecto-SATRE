<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Alert;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\Incident;
use App\Models\PermissionRequest;
use App\Models\ResidentialPresence;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AcademicModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_records_grade_in_ib_scale_and_update_is_audited(): void
    {
        $context = $this->academicContext();

        $gradeId = $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/grades', $this->gradePayload($context))
            ->assertCreated()
            ->assertJsonPath('data.score', 5)
            ->assertJsonPath('data.criterion', 'B')
            ->json('data.id');

        $this->assertDatabaseHas('audit_logs', ['action' => 'grade.recorded', 'auditable_id' => $gradeId]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->putJson("/api/grades/$gradeId", ['score' => 6])
            ->assertOk()
            ->assertJsonPath('data.score', 6);

        $log = AuditLog::query()->where('action', 'grade.updated')->firstOrFail();
        $this->assertEquals(5, $log->old_values['score']);
        $this->assertEquals(6, $log->new_values['score']);
    }

    public function test_grade_outside_ib_range_or_invalid_criterion_is_rejected(): void
    {
        $context = $this->academicContext();

        foreach ([0, 8, 4.5] as $score) {
            $this->actingAs($context['teacherUser'], 'sanctum')
                ->postJson('/api/grades', ['score' => $score] + $this->gradePayload($context))
                ->assertStatus(422)
                ->assertJsonValidationErrors(['score']);
        }

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/grades', ['criterion' => 'E'] + $this->gradePayload($context))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['criterion']);
    }

    public function test_teacher_cannot_grade_or_list_other_teachers_courses(): void
    {
        $context = $this->academicContext();
        $otherTeacherUser = $this->userWithRole(Roles::TEACHER);
        Teacher::factory()->create(['user_id' => $otherTeacherUser->id]);

        $this->actingAs($otherTeacherUser, 'sanctum')
            ->postJson('/api/grades', $this->gradePayload($context))
            ->assertForbidden();

        $grade = $this->createGrade($context, 5);

        $this->actingAs($otherTeacherUser, 'sanctum')
            ->putJson("/api/grades/{$grade->id}", ['score' => 2])
            ->assertForbidden();

        $this->actingAs($otherTeacherUser, 'sanctum')
            ->getJson('/api/grades')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson('/api/grades')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.per_page', 15);
    }

    public function test_monitor_records_and_updates_presence_and_admin_only_reads(): void
    {
        $context = $this->academicContext();
        $monitor = $this->userWithRole(Roles::MONITOR);
        $payload = [
            'student_id' => $context['student']->id,
            'presence_date' => '2026-04-15',
            'check_type' => 'night',
            'status' => 'present',
        ];

        $presenceId = $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/presences', $payload)
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($monitor, 'sanctum')->postJson('/api/presences', $payload)->assertStatus(422);

        $this->actingAs($monitor, 'sanctum')
            ->putJson("/api/presences/$presenceId", ['status' => 'absent'])
            ->assertOk()
            ->assertJsonPath('data.status', 'absent');

        $this->assertDatabaseHas('audit_logs', ['action' => 'presence.updated', 'auditable_id' => $presenceId]);

        $admin = $this->userWithRole(Roles::ADMIN);
        $this->actingAs($admin, 'sanctum')->getJson('/api/presences')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin, 'sanctum')->putJson("/api/presences/$presenceId", ['status' => 'present'])->assertForbidden();
    }

    public function test_incidents_are_audited_and_teacher_only_sees_own_classroom(): void
    {
        $context = $this->academicContext();
        $monitor = $this->userWithRole(Roles::MONITOR);
        $outsider = Student::factory()->create();

        $incidentId = $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/incidents', [
                'student_id' => $context['student']->id,
                'incident_at' => '2026-04-15 21:30:00',
                'category' => 'convivencia',
                'severity' => 'leve',
                'description' => 'Discusión en el pabellón.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'open')
            ->json('data.id');

        Incident::query()->create([
            'student_id' => $outsider->id,
            'reported_by' => $monitor->id,
            'incident_at' => '2026-04-15 21:30:00',
            'category' => 'conducta',
            'severity' => 'leve',
            'description' => 'Otro aula.',
        ]);

        $this->actingAs($monitor, 'sanctum')
            ->putJson("/api/incidents/$incidentId", ['severity' => 'moderada', 'status' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('data.severity', 'moderada')
            ->assertJsonPath('data.status', 'resolved');

        $log = AuditLog::query()->where('action', 'incident.updated')->firstOrFail();
        $this->assertSame('leve', $log->old_values['severity']);
        $this->assertSame('moderada', $log->new_values['severity']);
        $this->assertNotNull(Incident::query()->find($incidentId)->resolved_at);

        $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/incidents', ['category' => 'otro', 'severity' => 'leve'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category']);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson('/api/incidents')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $incidentId);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->putJson("/api/incidents/$incidentId", ['severity' => 'grave'])
            ->assertForbidden();
    }

    public function test_permission_flow_student_guardian_monitor(): void
    {
        $context = $this->academicContext();
        [$studentUser, $guardianUser] = $this->studentWithGuardian($context['student']);
        $monitor = $this->userWithRole(Roles::MONITOR);

        $permissionId = $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/permissions', [
                'type' => 'salida',
                'reason' => 'Cita médica',
                'starts_at' => '2026-04-18 08:00:00',
                'ends_at' => '2026-04-18 18:00:00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', PermissionRequest::STATUS_PENDING_GUARDIAN)
            ->json('data.id');

        $this->actingAs($monitor, 'sanctum')
            ->patchJson("/api/permissions/$permissionId/resolve", ['decision' => 'approved'])
            ->assertStatus(422);

        $otherGuardianUser = $this->userWithRole(Roles::GUARDIAN);
        Guardian::query()->create(['user_id' => $otherGuardianUser->id, 'document_number' => '20202020', 'first_name' => 'Otro', 'last_name' => 'Apoderado']);
        $this->actingAs($otherGuardianUser, 'sanctum')
            ->patchJson("/api/permissions/$permissionId/guardian", ['decision' => 'approved'])
            ->assertForbidden();

        $this->actingAs($guardianUser, 'sanctum')
            ->patchJson("/api/permissions/$permissionId/guardian", ['decision' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', PermissionRequest::STATUS_APPROVED_GUARDIAN);

        $this->actingAs($monitor, 'sanctum')
            ->patchJson("/api/permissions/$permissionId/resolve", ['decision' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', PermissionRequest::STATUS_APPROVED)
            ->assertJsonPath('data.reviewed_by', $monitor->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'permission.resolved', 'auditable_id' => $permissionId]);

        $this->actingAs($guardianUser, 'sanctum')->getJson('/api/permissions')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($otherGuardianUser, 'sanctum')->getJson('/api/permissions')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_me_summary_for_student_and_linked_guardian_only(): void
    {
        $context = $this->academicContext();
        [$studentUser, $guardianUser] = $this->studentWithGuardian($context['student']);
        $this->createGrade($context, 3);
        $this->createGrade($context, 6);
        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => '2026-04-15',
            'status' => 'present',
            'recorded_by' => $context['teacherUser']->id,
        ]);
        Alert::query()->create([
            'student_id' => $context['student']->id,
            'type' => 'risk',
            'severity' => 'ALTO',
            'title' => 'Riesgo alto',
            'message' => 'Revisar',
            'status' => 'open',
        ]);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/me/summary')
            ->assertOk()
            ->assertJsonPath('data.student.id', $context['student']->id)
            ->assertJsonPath('data.grades.average', 4.5)
            ->assertJsonPath('data.attendance.total', 1)
            ->assertJsonPath('data.attendance.rate', 1)
            ->assertJsonPath('data.alerts.open', 1);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson('/api/me/summary?student_id='.$context['student']->id)
            ->assertOk()
            ->assertJsonPath('data.grades.by_course.0.passing', true);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson('/api/me/summary?student_id='.Student::factory()->create()->id)
            ->assertForbidden();

        $this->actingAs($guardianUser, 'sanctum')->getJson('/api/me/summary')->assertStatus(422);
    }

    public function test_guardian_profile_lists_linked_students(): void
    {
        $context = $this->academicContext();
        [, $guardianUser] = $this->studentWithGuardian($context['student']);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonCount(1, 'user.students')
            ->assertJsonPath('user.students.0.id', $context['student']->id)
            ->assertJsonPath('user.students.0.classroom', $context['classroom']->name);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonMissingPath('user.students');
    }

    public function test_me_summary_includes_night_residence_for_boarders(): void
    {
        $context = $this->academicContext();
        [$studentUser, $guardianUser] = $this->studentWithGuardian($context['student']);
        $context['student']->update(['is_boarder' => true]);
        $monitor = $this->userWithRole(Roles::MONITOR);
        $date = $context['period']->start_date->copy()->addDay();
        foreach (['present', 'present', 'absent', 'on_permission'] as $i => $status) {
            ResidentialPresence::query()->create([
                'student_id' => $context['student']->id,
                'presence_date' => $date->copy()->addDays($i)->toDateString(),
                'check_type' => 'night',
                'status' => $status,
                'recorded_by' => $monitor->id,
            ]);
        }

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson('/api/me/summary?student_id='.$context['student']->id)
            ->assertOk()
            ->assertJsonPath('data.residence.total', 4)
            ->assertJsonPath('data.residence.by_status.absent', 1)
            ->assertJsonPath('data.residence.rate', 0.75);

        $context['student']->update(['is_boarder' => false]);
        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/me/summary')
            ->assertOk()
            ->assertJsonPath('data.residence', null);
    }

    public function test_guardian_sees_only_children_coexistence_incidents_without_description(): void
    {
        $context = $this->academicContext();
        [, $guardianUser] = $this->studentWithGuardian($context['student']);
        $monitor = $this->userWithRole(Roles::MONITOR);
        $incident = fn (Student $student, string $category) => Incident::query()->create([
            'student_id' => $student->id,
            'reported_by' => $monitor->id,
            'incident_at' => '2026-04-15 21:30:00',
            'category' => $category,
            'severity' => 'leve',
            'description' => 'Detalle confidencial',
        ]);
        $visible = $incident($context['student'], 'convivencia');
        $incident($context['student'], 'conducta');
        $incident($context['student'], 'salud');
        $incident($context['student'], 'emocional');
        $incident(Student::factory()->create(), 'convivencia');

        $response = $this->actingAs($guardianUser, 'sanctum')
            ->getJson('/api/incidents')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonMissingPath('data.0.description')
            ->assertJsonMissingPath('data.0.reported_by');

        $this->assertEqualsCanonicalizing(['convivencia', 'conducta'], array_column($response->json('data'), 'category'));

        $this->actingAs($monitor, 'sanctum')
            ->getJson('/api/incidents?student_id='.$context['student']->id)
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.description', 'Detalle confidencial');

        $this->assertNotNull($visible->id);
    }

    public function test_me_summary_without_data_returns_empty_values(): void
    {
        $context = $this->academicContext();
        [$studentUser] = $this->studentWithGuardian($context['student']);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/me/summary')
            ->assertOk()
            ->assertJsonPath('data.grades.average', null)
            ->assertJsonPath('data.attendance.rate', null)
            ->assertJsonPath('data.alerts.open', 0);
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

    private function createGrade(array $context, int $score): Grade
    {
        return Grade::query()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'evaluation_name' => 'Prueba',
            'criterion' => 'A',
            'evaluation_date' => '2026-04-10',
            'score' => $score,
            'recorded_by' => $context['teacherUser']->id,
        ]);
    }

    /**
     * @return array{User, User}
     */
    private function studentWithGuardian(Student $student): array
    {
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student->update(['user_id' => $studentUser->id]);

        $guardianUser = $this->userWithRole(Roles::GUARDIAN);
        $guardian = Guardian::query()->create(['user_id' => $guardianUser->id, 'document_number' => '10101010', 'first_name' => 'Héctor', 'last_name' => 'Chávez']);
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
