<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassroomAttendanceSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_list_own_courses(): void
    {
        $context = $this->academicContext();
        $this->otherTeacherCourse();

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson('/api/courses')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $context['course']->id)
            ->assertJsonPath('data.0.classroom.id', $context['classroom']->id);
    }

    public function test_teacher_can_load_attendance_session_roster(): void
    {
        $context = $this->academicContext();
        $second = Student::factory()->create(['classroom_id' => $context['classroom']->id]);
        Enrollment::factory()->create([
            'student_id' => $second->id,
            'course_id' => $context['course']->id,
        ]);

        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => '2026-09-15',
            'status' => 'late',
            'recorded_by' => $context['teacherUser']->id,
        ]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson('/api/courses/'.$context['course']->id.'/attendance-session?attendance_date=2026-09-15')
            ->assertOk()
            ->assertJsonPath('data.course_id', $context['course']->id)
            ->assertJsonPath('data.attendance_date', '2026-09-15')
            ->assertJsonCount(2, 'data.students');
    }

    public function test_teacher_can_save_attendance_session_and_update_existing_records(): void
    {
        $context = $this->academicContext();
        $second = Student::factory()->create(['classroom_id' => $context['classroom']->id]);
        Enrollment::factory()->create([
            'student_id' => $second->id,
            'course_id' => $context['course']->id,
        ]);

        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => '2026-09-15',
            'status' => 'present',
            'recorded_by' => $context['teacherUser']->id,
        ]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances/session', [
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-09-15',
                'records' => [
                    ['student_id' => $context['student']->id, 'status' => 'absent'],
                    ['student_id' => $second->id, 'status' => 'late', 'notes' => '10 minutos'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Asistencia registrada.')
            ->assertJsonCount(2, 'data');

        $this->assertDatabaseHas('attendances', [
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'status' => 'absent',
        ]);
        $this->assertDatabaseHas('attendances', [
            'student_id' => $second->id,
            'status' => 'late',
        ]);
        $this->assertDatabaseCount('attendances', 2);
    }

    public function test_session_rejects_unenrolled_student_and_invalid_status(): void
    {
        $context = $this->academicContext();
        $outsider = Student::factory()->create(['classroom_id' => $context['classroom']->id]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances/session', [
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-09-15',
                'records' => [
                    ['student_id' => $outsider->id, 'status' => 'present'],
                ],
            ])
            ->assertStatus(422);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/attendances/session', [
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-09-15',
                'records' => [
                    ['student_id' => $context['student']->id, 'status' => 'inventado'],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['records.0.status']);
    }

    public function test_student_cannot_access_attendance_session(): void
    {
        $context = $this->academicContext();
        $studentUser = $this->userWithRole(Roles::STUDENT);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/courses')
            ->assertForbidden();

        $this->actingAs($studentUser, 'sanctum')
            ->postJson('/api/attendances/session', [
                'course_id' => $context['course']->id,
                'attendance_date' => '2026-09-15',
                'records' => [
                    ['student_id' => $context['student']->id, 'status' => 'present'],
                ],
            ])
            ->assertForbidden();
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

    private function otherTeacherCourse(): Course
    {
        $period = AcademicPeriod::query()->first();
        $otherUser = $this->userWithRole(Roles::TEACHER);
        $otherTeacher = Teacher::factory()->create(['user_id' => $otherUser->id]);
        $classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $otherTeacher->id,
        ]);

        return Course::factory()->create([
            'classroom_id' => $classroom->id,
            'teacher_id' => $otherTeacher->id,
            'academic_period_id' => $period->id,
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
        ]);
    }
}
