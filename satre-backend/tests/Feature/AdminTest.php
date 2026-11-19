<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Alert;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Classroom;
use App\Models\Enrollment;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\Feature\Admin\InteractsWithAdmin;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use InteractsWithAdmin, RefreshDatabase;

    private const USERS_ENDPOINT = '/api/admin/users';
    private const METRICS_ENDPOINT = '/api/admin/metrics';
    private const ADMIN_EMAIL = 'ana@coar.edu.pe';
    private const NEW_USER_DNI = '87654322';
    private const NEW_USER_NAME = 'Nombre Nuevo';
    private const COURSES_ENDPOINT = '/api/admin/courses';
    private const PERIODS_ENDPOINT = '/api/admin/periods';
    private const ENROLLMENTS_ENDPOINT = '/api/admin/enrollments';
    private const ENROLLMENTS_BULK_ENDPOINT = '/api/admin/enrollments/bulk';
    private const JSON_ACCEPT = 'application/json';

    public function test_non_admin_cannot_access_admin_routes(): void
    {
        $teacher = $this->userWithRole(Roles::TEACHER);

        $this->actingAs($teacher, 'sanctum')->getJson(self::USERS_ENDPOINT)->assertForbidden();
        $this->actingAs($teacher, 'sanctum')->getJson(self::METRICS_ENDPOINT)->assertForbidden();
        $this->actingAs($teacher, 'sanctum')->getJson('/api/admin/audit-logs')->assertForbidden();
    }

    public function test_admin_lists_users_paginated_and_filtered(): void
    {
        $admin = $this->admin();
        User::factory()->count(20)->create();

        $this->actingAs($admin, 'sanctum')
            ->getJson(self::USERS_ENDPOINT)
            ->assertOk()
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 21);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?role=admin')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_user_listing_exposes_profile_id_for_assignment_pickers(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin, 'sanctum')->postJson(self::USERS_ENDPOINT, [
            'name' => 'Ana Rojas',
            'email' => self::ADMIN_EMAIL,
            'dni' => '87654321',
            'role' => Roles::TEACHER,
            'profile' => ['employee_code' => 'DOC-0101'],
        ])->assertCreated();
        $teacher = User::query()->where('email', self::ADMIN_EMAIL)->firstOrFail()->teacher;

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?role=teacher')
            ->assertOk()
            ->assertJsonPath('data.0.profile_id', $teacher->id);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?role=admin')
            ->assertJsonPath('data.0.profile_id', null);
    }

    public function test_admin_creates_teacher_with_profile_and_temporary_password(): void
    {
        $admin = $this->admin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson(self::USERS_ENDPOINT, [
                'name' => 'Ana Rojas',
                'email' => self::ADMIN_EMAIL,
                'dni' => self::NEW_USER_DNI,
                'role' => Roles::TEACHER,
                'profile' => ['employee_code' => 'DOC-0100', 'specialty' => 'Física'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::TEACHER)
            ->assertJsonPath('data.must_change_password', true);

        $user = User::query()->where('email', self::ADMIN_EMAIL)->firstOrFail();
        $this->assertTrue(Hash::check($response->json('temporary_password'), $user->password));
        $this->assertDatabaseHas('users', ['id' => $user->id, 'dni' => self::NEW_USER_DNI]);
        $this->assertDatabaseHas('teachers', ['user_id' => $user->id, 'employee_code' => 'DOC-0100', 'dni' => self::NEW_USER_DNI]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created', 'auditable_id' => $user->id, 'user_id' => $admin->id]);
    }

    public function test_student_user_requires_profile(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->postJson(self::USERS_ENDPOINT, [
                'name' => 'Sin Perfil',
                'email' => 'sin.perfil@coar.edu.pe',
                'dni' => '12345678',
                'role' => Roles::STUDENT,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['profile', 'profile.student_code', 'profile.document_number']);
    }

    public function test_admin_shows_updates_and_audits_user(): void
    {
        $admin = $this->admin();
        $user = $this->userWithRole(Roles::MONITOR, ['name' => 'Nombre Viejo']);

        $this->actingAs($admin, 'sanctum')
            ->getJson(self::USERS_ENDPOINT."/$user->id")
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);

        $this->actingAs($admin, 'sanctum')
            ->putJson(self::USERS_ENDPOINT."/$user->id", ['name' => self::NEW_USER_NAME])
            ->assertOk()
            ->assertJsonPath('data.name', self::NEW_USER_NAME);

        $log = AuditLog::query()->where('action', 'user.updated')->where('auditable_id', $user->id)->firstOrFail();
        $this->assertSame(['name' => 'Nombre Viejo'], $log->old_values);
        $this->assertSame(['name' => self::NEW_USER_NAME], $log->new_values);
    }

    public function test_toggle_active_deactivates_user_and_revokes_tokens(): void
    {
        $admin = $this->admin();
        $user = $this->userWithRole(Roles::TEACHER);
        $user->createToken('web');

        $this->actingAs($admin, 'sanctum')
            ->patchJson(self::USERS_ENDPOINT."/$user->id/toggle-active")
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.active_toggled', 'auditable_id' => $user->id]);
    }

    public function test_admin_cannot_deactivate_or_reset_own_account(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->patchJson(self::USERS_ENDPOINT."/$admin->id/toggle-active")
            ->assertStatus(422);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::USERS_ENDPOINT."/$admin->id/reset-password")
            ->assertStatus(422);
    }

    public function test_reset_password_issues_temporary_password_and_forces_change(): void
    {
        $admin = $this->admin();
        $user = $this->userWithRole(Roles::TEACHER, ['must_change_password' => false]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson(self::USERS_ENDPOINT."/$user->id/reset-password")
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $this->assertTrue(Hash::check($response->json('temporary_password'), $user->fresh()->password));
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.password_reset_by_admin', 'auditable_id' => $user->id]);
    }

    public function test_user_with_profile_cannot_be_deleted(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson(self::USERS_ENDPOINT.'/'.$context['teacher']->user_id)
            ->assertStatus(422);

        $plain = $this->userWithRole(Roles::ADMIN);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson(self::USERS_ENDPOINT."/$plain->id")
            ->assertOk();

        $this->assertSoftDeleted('users', ['id' => $plain->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.deleted', 'auditable_id' => $plain->id]);
    }

    public function test_admin_creates_and_lists_classrooms_with_tutor(): void
    {
        $admin = $this->admin();
        $period = AcademicPeriod::factory()->create();
        $teacher = Teacher::factory()->create(['user_id' => $this->userWithRole(Roles::TEACHER)->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/classrooms', [
                'name' => '4to B',
                'grade_level' => '4to',
                'capacity' => 25,
                'academic_period_id' => $period->id,
                'tutor_id' => $teacher->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.tutor.id', $teacher->id)
            ->assertJsonPath('data.academic_period.id', $period->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'classroom.created']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/classrooms?academic_period_id='.$period->id)
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.tutor.id', $teacher->id);
    }

    public function test_admin_reassigns_classroom_tutor_with_audit(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $newTutor = Teacher::factory()->create(['user_id' => $this->userWithRole(Roles::TEACHER)->id]);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/admin/classrooms/'.$context['classroom']->id, ['tutor_id' => $newTutor->id])
            ->assertOk()
            ->assertJsonPath('data.tutor.id', $newTutor->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'classroom.updated', 'auditable_id' => $context['classroom']->id]);
    }

    public function test_classroom_with_courses_cannot_be_deleted(): void
    {
        $context = $this->academicContext();

        $this->actingAs($this->admin(), 'sanctum')
            ->deleteJson('/api/admin/classrooms/'.$context['classroom']->id)
            ->assertStatus(422);
    }

    public function test_admin_creates_course_assigning_teacher_classroom_and_period(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::COURSES_ENDPOINT, [
                'code' => 'FIS-HL',
                'name' => 'Física HL',
                'classroom_id' => $context['classroom']->id,
                'teacher_id' => $context['teacher']->id,
                'academic_period_id' => $context['period']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.teacher.id', $context['teacher']->id)
            ->assertJsonPath('data.classroom.id', $context['classroom']->id)
            ->assertJsonPath('data.academic_period.id', $context['period']->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'course.created']);
    }

    public function test_course_rejects_classroom_from_other_period_and_duplicate_code(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $otherPeriod = AcademicPeriod::factory()->create(['name' => '2026-II', 'is_current' => false]);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::COURSES_ENDPOINT, [
                'code' => 'QUI-SL',
                'name' => 'Química SL',
                'classroom_id' => $context['classroom']->id,
                'teacher_id' => $context['teacher']->id,
                'academic_period_id' => $otherPeriod->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['classroom_id']);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::COURSES_ENDPOINT, [
                'code' => 'MAT-AA',
                'name' => 'Duplicado',
                'classroom_id' => $context['classroom']->id,
                'teacher_id' => $context['teacher']->id,
                'academic_period_id' => $context['period']->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_course_with_enrollments_cannot_be_deleted(): void
    {
        $context = $this->academicContext();
        Enrollment::factory()->create(['student_id' => $context['student']->id, 'course_id' => $context['course']->id]);

        $this->actingAs($this->admin(), 'sanctum')
            ->deleteJson(self::COURSES_ENDPOINT.'/'.$context['course']->id)
            ->assertStatus(422);
    }

    public function test_admin_lists_and_updates_courses(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/courses?academic_period_id='.$context['period']->id)
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.teacher.id', $context['teacher']->id);

        $this->actingAs($admin, 'sanctum')
            ->putJson(self::COURSES_ENDPOINT.'/'.$context['course']->id, ['name' => 'Matemáticas AA'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Matemáticas AA');
    }

    public function test_admin_creates_period_and_validates_dates(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::PERIODS_ENDPOINT, ['name' => '2027-I', 'start_date' => '2027-03-01', 'end_date' => '2027-02-01'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::PERIODS_ENDPOINT, ['name' => '2027-I', 'start_date' => '2027-03-01', 'end_date' => '2027-07-31'])
            ->assertCreated()
            ->assertJsonPath('data.is_current', false);

        $this->assertDatabaseHas('audit_logs', ['action' => 'period.created']);

        $this->actingAs($admin, 'sanctum')
            ->getJson(self::PERIODS_ENDPOINT)
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15);
    }

    public function test_set_current_leaves_a_single_current_period(): void
    {
        $admin = $this->admin();
        $current = AcademicPeriod::factory()->create(['is_current' => true]);
        $next = AcademicPeriod::factory()->create(['name' => '2026-II', 'is_current' => false]);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::PERIODS_ENDPOINT."/$next->id/set-current")
            ->assertOk()
            ->assertJsonPath('data.is_current', true);

        $this->assertFalse($current->fresh()->is_current);
        $this->assertSame(1, AcademicPeriod::query()->where('is_current', true)->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'period.set_current', 'auditable_id' => $next->id]);
    }

    public function test_period_in_use_cannot_be_deleted(): void
    {
        $context = $this->academicContext();

        $this->actingAs($this->admin(), 'sanctum')
            ->deleteJson(self::PERIODS_ENDPOINT.'/'.$context['period']->id)
            ->assertStatus(422);

        $this->assertModelExists(Classroom::query()->find($context['classroom']->id));
    }

    public function test_admin_enrolls_student_individually(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::ENROLLMENTS_ENDPOINT, [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.student.id', $context['student']->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.created']);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::ENROLLMENTS_ENDPOINT, [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
            ])
            ->assertStatus(422);
    }

    public function test_delete_withdraws_enrollment_and_post_reactivates_it(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $enrollment = Enrollment::factory()->create(['student_id' => $context['student']->id, 'course_id' => $context['course']->id]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson(self::ENROLLMENTS_ENDPOINT."/$enrollment->id")
            ->assertOk()
            ->assertJsonPath('data.status', 'withdrawn');

        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.withdrawn', 'auditable_id' => $enrollment->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::ENROLLMENTS_ENDPOINT, [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.id', $enrollment->id)
            ->assertJsonPath('data.status', 'active');
    }

    public function test_bulk_csv_enrolls_creates_and_skips_existing(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $second = Student::factory()->create(['classroom_id' => $context['classroom']->id, 'student_code' => 'EST-0002']);
        Enrollment::factory()->create(['student_id' => $second->id, 'course_id' => $context['course']->id]);

        $csv = "\xEF\xBB\xBFstudent_code,course_code\nEST-0001,MAT-AA\nEST-0002,MAT-AA\nEST-0001,MAT-AA\n";

        $this->actingAs($admin, 'sanctum')
            ->post(self::ENROLLMENTS_BULK_ENDPOINT, [
                'file' => UploadedFile::fake()->createWithContent('matriculas.csv', $csv),
                'academic_period_id' => $context['period']->id,
            ], ['Accept' => self::JSON_ACCEPT])
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.skipped', 2);

        $this->assertDatabaseHas('enrollments', ['student_id' => $context['student']->id, 'course_id' => $context['course']->id, 'status' => 'active']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.imported']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.bulk_imported']);
    }

    public function test_bulk_csv_with_invalid_row_writes_nothing(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $csv = "student_code;course_code\nEST-0001;MAT-AA\nEST-9999;MAT-AA\n";

        $this->actingAs($admin, 'sanctum')
            ->post(self::ENROLLMENTS_BULK_ENDPOINT, [
                'file' => UploadedFile::fake()->createWithContent('matriculas.csv', $csv),
                'academic_period_id' => $context['period']->id,
            ], ['Accept' => self::JSON_ACCEPT])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['rows.3']);

        $this->assertDatabaseCount('enrollments', 0);
    }

    public function test_bulk_csv_requires_expected_columns(): void
    {
        $context = $this->academicContext();

        $this->actingAs($this->admin(), 'sanctum')
            ->post(self::ENROLLMENTS_BULK_ENDPOINT, [
                'file' => UploadedFile::fake()->createWithContent('matriculas.csv', "codigo,curso\nEST-0001,MAT-AA\n"),
                'academic_period_id' => $context['period']->id,
            ], ['Accept' => self::JSON_ACCEPT])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_admin_links_guardian_to_student_as_primary(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $guardian = Guardian::query()->create(['document_number' => '40000001', 'first_name' => 'Rosa', 'last_name' => 'Poma']);
        $previous = Guardian::query()->create(['document_number' => '40000002', 'first_name' => 'Juan', 'last_name' => 'Poma']);
        $previous->students()->attach($context['student']->id, ['relationship' => 'padre', 'is_primary' => true]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/guardians/$guardian->id/students", [
                'student_id' => $context['student']->id,
                'relationship' => 'madre',
                'is_primary' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.students.0.id', $context['student']->id)
            ->assertJsonPath('data.students.0.is_primary', true);

        $this->assertDatabaseHas('guardian_student', ['guardian_id' => $previous->id, 'student_id' => $context['student']->id, 'is_primary' => false]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'guardian.student_linked', 'auditable_id' => $guardian->id]);
    }

    public function test_metrics_without_data_return_200_with_insufficient_data(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson(self::METRICS_ENDPOINT)
            ->assertOk()
            ->assertJsonPath('data.users.active', 1)
            ->assertJsonPath('data.attendance_coverage.rate', null)
            ->assertJsonPath('data.attendance_coverage.insufficient_data', true)
            ->assertJsonPath('data.alerts.open', 0);
    }

    public function test_metrics_report_active_users_coverage_and_open_alerts(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $this->userWithRole(Roles::MONITOR, ['is_active' => false]);

        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => today()->toDateString(),
            'recorded_by' => $context['teacher']->user_id,
        ]);

        foreach (['open', 'open', 'resolved'] as $status) {
            Alert::query()->create([
                'student_id' => $context['student']->id,
                'type' => 'risk',
                'severity' => 'ALTO',
                'title' => 'Riesgo',
                'message' => 'Riesgo alto',
                'status' => $status,
            ]);
        }

        $this->actingAs($admin, 'sanctum')
            ->getJson(self::METRICS_ENDPOINT)
            ->assertOk()
            ->assertJsonPath('data.users.active', 2)
            ->assertJsonPath('data.users.inactive', 1)
            ->assertJsonPath('data.attendance_coverage.courses_total', 1)
            ->assertJsonPath('data.attendance_coverage.courses_with_attendance', 1)
            ->assertJsonPath('data.attendance_coverage.rate', 1)
            ->assertJsonPath('data.alerts.open', 2)
            ->assertJsonPath('data.alerts.open_by_severity.ALTO', 2);
    }

    public function test_audit_logs_are_paginated_and_filtered(): void
    {
        $admin = $this->admin();
        $other = $this->userWithRole(Roles::TEACHER);

        for ($recordCount = 0; $recordCount < 16; ++$recordCount) {
            AuditLog::query()->create(['user_id' => $admin->id, 'action' => 'user.updated', 'created_at' => '2026-05-10 10:00:00']);
        }
        AuditLog::query()->create(['user_id' => $other->id, 'action' => 'attendance.recorded', 'created_at' => '2026-06-01 08:00:00']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.total', 17);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/audit-logs?user_id=$other->id")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.user.id', $other->id);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs?action=attendance.')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs?date_from=2026-05-01&date_to=2026-05-31')
            ->assertOk()
            ->assertJsonPath('meta.total', 16);
    }

    public function test_audit_logs_reject_inverted_date_range(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/audit-logs?date_from=2026-06-01&date_to=2026-05-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['date_to']);
    }
}
