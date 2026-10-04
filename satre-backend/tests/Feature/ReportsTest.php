<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Alert;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\RiskPrediction;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportsTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_gets_classroom_analytics_with_ib_summary(): void
    {
        $context = $this->reportContext();

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson("/api/reports/classrooms/{$context['classroom']->id}/analytics")
            ->assertOk()
            ->assertJsonPath('data.insufficient_data', false)
            ->assertJsonPath('data.summary.students', 2)
            ->assertJsonPath('data.summary.grade_mean', 4)
            ->assertJsonPath('data.summary.pass_rate', 0.5)
            ->assertJsonPath('data.summary.attendance_rate', 0.5)
            ->assertJsonPath('data.summary.open_alerts', 1)
            ->assertJsonPath('data.risk_distribution.ALTO', 1)
            ->assertJsonPath('data.risk_distribution.MEDIO', 0)
            ->assertJsonPath('data.risk_distribution.BAJO', 0)
            ->assertJsonPath('data.courses.0.course_name', 'Matemáticas AA')
            ->assertJsonPath('data.courses.0.grade_mean', 4)
            ->assertJsonPath('data.courses.0.pass_rate', 0.5);
    }

    public function test_teacher_exports_classroom_report_as_csv(): void
    {
        $context = $this->reportContext();

        $response = $this->actingAs($context['teacherUser'], 'sanctum')
            ->get("/api/reports/classrooms/{$context['classroom']->id}/export?format=csv");

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $response->assertDownload("reporte-aula-{$context['classroom']->id}.csv");

        $csv = $response->getContent();
        $this->assertStringContainsString('EST-PASS', $csv);
        $this->assertStringContainsString('EST-FAIL', $csv);
        $this->assertStringContainsString('Matemáticas AA', $csv);
        $this->assertStringContainsString('ALTO', $csv);
    }

    public function test_teacher_exports_classroom_report_as_pdf(): void
    {
        $context = $this->reportContext();

        $response = $this->actingAs($context['teacherUser'], 'sanctum')
            ->get("/api/reports/classrooms/{$context['classroom']->id}/export?format=pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
        $response->assertDownload("reporte-aula-{$context['classroom']->id}.pdf");
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_export_rejects_invalid_format(): void
    {
        $context = $this->reportContext();

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson("/api/reports/classrooms/{$context['classroom']->id}/export?format=xlsx")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['format']);
    }

    public function test_teacher_cannot_export_another_classroom(): void
    {
        $context = $this->reportContext();
        $other = Classroom::factory()->create(['academic_period_id' => $context['period']->id]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson("/api/reports/classrooms/{$other->id}/export?format=csv")
            ->assertForbidden();
    }

    public function test_monitor_cannot_access_classroom_reports(): void
    {
        $context = $this->reportContext();
        $monitor = $this->userWithRole(Roles::MONITOR);

        $this->actingAs($monitor, 'sanctum')
            ->getJson("/api/reports/classrooms/{$context['classroom']->id}/analytics")
            ->assertForbidden();

        $this->actingAs($monitor, 'sanctum')
            ->getJson("/api/reports/classrooms/{$context['classroom']->id}/export?format=csv")
            ->assertForbidden();
    }

    public function test_admin_can_read_analytics_and_export(): void
    {
        $context = $this->reportContext();
        $admin = $this->userWithRole(Roles::ADMIN);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/reports/classrooms/{$context['classroom']->id}/analytics")
            ->assertOk()
            ->assertJsonPath('data.summary.students', 2);

        $this->actingAs($admin, 'sanctum')
            ->get("/api/reports/classrooms/{$context['classroom']->id}/export?format=csv")
            ->assertOk();
    }

    public function test_empty_classroom_is_insufficient_data(): void
    {
        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);

        $this->actingAs($teacherUser, 'sanctum')
            ->getJson("/api/reports/classrooms/{$classroom->id}/analytics")
            ->assertOk()
            ->assertJsonPath('data.insufficient_data', true)
            ->assertJsonPath('data.summary.students', 0)
            ->assertJsonPath('data.summary.grade_mean', null);
    }

    public function test_student_and_guardian_read_own_performance(): void
    {
        $context = $this->reportContext();
        [$studentUser, $guardianUser] = $this->linkStudentUser($context['passing']);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/reports/students/{$context['passing']->id}/performance")
            ->assertOk()
            ->assertJsonPath('data.student.student_code', 'EST-PASS')
            ->assertJsonPath('data.grades.average', 5);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson("/api/reports/students/{$context['passing']->id}/performance")
            ->assertOk()
            ->assertJsonPath('data.student.student_code', 'EST-PASS');
    }

    public function test_student_cannot_read_another_students_performance(): void
    {
        $context = $this->reportContext();
        [$studentUser] = $this->linkStudentUser($context['passing']);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/reports/students/{$context['failing']->id}/performance")
            ->assertForbidden();
    }

    /**
     * @return array{
     *     teacherUser: User,
     *     classroom: Classroom,
     *     course: Course,
     *     period: AcademicPeriod,
     *     passing: Student,
     *     failing: Student
     * }
     */
    private function reportContext(): array
    {
        $period = AcademicPeriod::factory()->create(['is_current' => true, 'name' => '2026-I']);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $classroom = Classroom::factory()->create([
            'name' => '5to A',
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);
        $course = Course::factory()->create([
            'name' => 'Matemáticas AA',
            'code' => 'MAT-AA',
            'classroom_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'academic_period_id' => $period->id,
        ]);

        $passing = Student::factory()->create([
            'classroom_id' => $classroom->id,
            'student_code' => 'EST-PASS',
            'first_name' => 'Ana',
            'last_name' => 'Rojas',
        ]);
        $failing = Student::factory()->create([
            'classroom_id' => $classroom->id,
            'student_code' => 'EST-FAIL',
            'first_name' => 'Luis',
            'last_name' => 'Poma',
        ]);

        foreach ([$passing, $failing] as $student) {
            Enrollment::factory()->create([
                'student_id' => $student->id,
                'course_id' => $course->id,
            ]);
        }

        $this->addGrade($passing, $course, $period, $teacherUser, 5);
        $this->addGrade($passing, $course, $period, $teacherUser, 5);
        $this->addGrade($failing, $course, $period, $teacherUser, 3);

        Attendance::factory()->create([
            'student_id' => $passing->id,
            'course_id' => $course->id,
            'academic_period_id' => $period->id,
            'status' => 'present',
            'recorded_by' => $teacherUser->id,
        ]);
        Attendance::factory()->absentUnjustified()->create([
            'student_id' => $failing->id,
            'course_id' => $course->id,
            'academic_period_id' => $period->id,
            'recorded_by' => $teacherUser->id,
        ]);

        RiskPrediction::factory()->create([
            'student_id' => $passing->id,
            'academic_period_id' => $period->id,
            'risk_level' => RiskPrediction::LEVEL_HIGH,
            'risk_score' => 72.5,
        ]);

        Alert::query()->create([
            'student_id' => $passing->id,
            'type' => Alert::TYPE_RISK,
            'severity' => 'ALTO',
            'title' => 'Riesgo ALTO',
            'message' => 'Fixture de reporte.',
            'status' => Alert::STATUS_OPEN,
        ]);

        return compact('teacherUser', 'classroom', 'course', 'period', 'passing', 'failing');
    }

    private function addGrade(Student $student, Course $course, AcademicPeriod $period, User $teacher, int $score): void
    {
        Grade::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'academic_period_id' => $period->id,
            'score' => $score,
            'criterion' => 'A',
            'recorded_by' => $teacher->id,
        ]);
    }

    /**
     * @return array{0: User, 1: User}
     */
    private function linkStudentUser(Student $student): array
    {
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student->update(['user_id' => $studentUser->id]);

        $guardianUser = $this->userWithRole(Roles::GUARDIAN);
        $guardian = Guardian::query()->create([
            'user_id' => $guardianUser->id,
            'document_number' => '10101010',
            'first_name' => 'Héctor',
            'last_name' => 'Rojas',
        ]);
        $guardian->students()->attach($student->id, ['relationship' => 'padre', 'is_primary' => true]);

        return [$studentUser, $guardianUser];
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
