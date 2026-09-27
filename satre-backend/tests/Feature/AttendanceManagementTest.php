<?php

namespace Tests\Feature;

use App\Events\AttendanceRecorded;
use App\Jobs\EvaluateStudentRiskJob;
use App\Models\AcademicPeriod;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
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

class AttendanceManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_record_attendance(): void
    {
        $this->postJson('/api/attendances', [])->assertUnauthorized();
    }

    public function test_student_cannot_record_attendance(): void
    {
        $context = $this->academicContext();
        $studentUser = $this->userWithRole(Roles::STUDENT);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/attendances', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-03-16',
                'status' => 'present',
            ])
            ->assertForbidden();
    }

    public function test_teacher_can_record_attendance_for_enrolled_student(): void
    {
        Event::fake([AttendanceRecorded::class]);

        $context = $this->academicContext();

        $response = $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-03-16',
                'status' => 'late',
                'notes' => 'Llegó 10 minutos tarde',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'late')
            ->assertJsonPath('data.student_id', $context['student']->id);

        $this->assertDatabaseHas('attendances', [
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'status' => 'late',
        ]);

        Event::assertDispatched(AttendanceRecorded::class);
    }

    public function test_attendance_requires_enrollment_and_valid_status(): void
    {
        $context = $this->academicContext();
        $otherStudent = Student::factory()->create([
            'classroom_id' => $context['classroom']->id,
        ]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances', [
                'student_id' => $otherStudent->id,
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-03-16',
                'status' => 'present',
            ])
            ->assertStatus(422);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-03-16',
                'status' => 'inventado',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_duplicate_attendance_for_same_day_is_rejected(): void
    {
        $context = $this->academicContext();

        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => '2026-03-16',
            'status' => 'present',
            'recorded_by' => $context['teacherUser']->id,
        ]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-03-16',
                'status' => 'absent',
            ])
            ->assertStatus(422);
    }

    public function test_recording_attendance_does_not_compute_features_or_risk(): void
    {
        Queue::fake();
        $context = $this->academicContext();

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-03-16',
                'status' => 'present',
            ])
            ->assertCreated();

        $this->assertSame(0, StudentFeatureSnapshot::query()->count());
        Queue::assertNotPushed(EvaluateStudentRiskJob::class);
    }

    public function test_attendance_session_does_not_compute_features_or_risk(): void
    {
        Queue::fake();
        $context = $this->academicContext();

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances/session', [
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-03-16',
                'records' => [
                    ['student_id' => $context['student']->id, 'status' => 'present'],
                ],
            ])
            ->assertSuccessful();

        $this->assertSame(0, StudentFeatureSnapshot::query()->count());
        Queue::assertNotPushed(EvaluateStudentRiskJob::class);
    }

    public function test_teacher_can_list_course_attendances(): void
    {
        $context = $this->academicContext();

        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => '2026-03-16',
            'recorded_by' => $context['teacherUser']->id,
        ]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson('/api/attendances?course_id='.$context['course']->id.'&attendance_date=2026-03-16')
            ->assertOk()
            ->assertJsonPath('data.0.student_id', $context['student']->id);
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
