<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\ResidentialPresence;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * §1 "R propio": el estudiante lee solo sus notas, asistencia de aula y presencia nocturna.
 */
class StudentSelfServiceTest extends TestCase
{
    use RefreshDatabase;

    private AcademicPeriod $period;

    private User $teacherUser;

    private Course $course;

    private Student $student;

    private Student $classmate;

    private User $studentUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->period = AcademicPeriod::factory()->create(['is_current' => true]);
        $this->teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $this->teacherUser->id]);
        $classroom = Classroom::factory()->create(['academic_period_id' => $this->period->id, 'tutor_id' => $teacher->id]);
        $this->course = Course::factory()->create([
            'classroom_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'academic_period_id' => $this->period->id,
        ]);

        $this->studentUser = $this->userWithRole(Roles::STUDENT);
        $this->student = Student::factory()->create(['user_id' => $this->studentUser->id, 'classroom_id' => $classroom->id]);
        $this->classmate = Student::factory()->create(['classroom_id' => $classroom->id]);

        foreach ([$this->student, $this->classmate] as $student) {
            Enrollment::factory()->create(['student_id' => $student->id, 'course_id' => $this->course->id]);
        }
    }

    public function test_student_lists_only_own_grades_paginated_with_course_name(): void
    {
        $this->grade($this->student, 'A', 5);
        $this->grade($this->student, 'B', 3);
        $this->grade($this->classmate, 'A', 7);

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson('/api/grades')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.student_id', $this->student->id)
            ->assertJsonPath('data.0.course_name', $this->course->name);

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson("/api/grades?student_id={$this->classmate->id}")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson('/api/grades?criterion=B')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.score', 3);
    }

    public function test_student_cannot_write_grades(): void
    {
        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson('/api/grades', ['student_id' => $this->student->id, 'course_id' => $this->course->id])
            ->assertForbidden();
    }

    public function test_student_lists_only_own_attendance_newest_first(): void
    {
        $this->attendance($this->student, '2026-04-10', 'present');
        $this->attendance($this->student, '2026-04-12', 'absent');
        $this->attendance($this->classmate, '2026-04-12', 'present');

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson('/api/attendances')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.attendance_date', '2026-04-12')
            ->assertJsonPath('data.0.course_name', $this->course->name);

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson('/api/attendances?status=present')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.attendance_date', '2026-04-10');
    }

    public function test_student_lists_only_own_night_presences(): void
    {
        $this->presence($this->student, '2026-04-10');
        $this->presence($this->classmate, '2026-04-10');

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson('/api/presences')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_id', $this->student->id);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson('/api/presences', ['student_id' => $this->student->id])
            ->assertForbidden();
    }

    public function test_student_without_profile_gets_empty_lists(): void
    {
        $orphan = $this->userWithRole(Roles::STUDENT);
        $this->grade($this->student, 'A', 5);

        $this->actingAs($orphan, 'sanctum')->getJson('/api/grades')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($orphan, 'sanctum')->getJson('/api/attendances')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($orphan, 'sanctum')->getJson('/api/presences')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_summary_includes_enrolled_courses_and_criteria_breakdown(): void
    {
        $this->grade($this->student, 'A', 5);
        $this->grade($this->student, 'A', 6);
        $this->grade($this->student, 'C', 3);

        $this->actingAs($this->studentUser, 'sanctum')
            ->getJson('/api/me/summary')
            ->assertOk()
            ->assertJsonPath('data.courses.0.id', $this->course->id)
            ->assertJsonPath('data.courses.0.name', $this->course->name)
            ->assertJsonPath('data.grades.by_course.0.criteria.A', 5.5)
            ->assertJsonPath('data.grades.by_course.0.criteria.B', null)
            ->assertJsonPath('data.grades.by_course.0.criteria.C', 3);
    }

    private function grade(Student $student, string $criterion, int $score): Grade
    {
        return Grade::query()->create([
            'student_id' => $student->id,
            'course_id' => $this->course->id,
            'academic_period_id' => $this->period->id,
            'evaluation_name' => "Evaluación $criterion",
            'criterion' => $criterion,
            'evaluation_date' => '2026-04-10',
            'score' => $score,
            'recorded_by' => $this->teacherUser->id,
        ]);
    }

    private function attendance(Student $student, string $date, string $status): Attendance
    {
        return Attendance::factory()->create([
            'student_id' => $student->id,
            'course_id' => $this->course->id,
            'academic_period_id' => $this->period->id,
            'attendance_date' => $date,
            'status' => $status,
            'recorded_by' => $this->teacherUser->id,
        ]);
    }

    private function presence(Student $student, string $date): ResidentialPresence
    {
        return ResidentialPresence::query()->create([
            'student_id' => $student->id,
            'presence_date' => $date,
            'check_type' => 'night',
            'status' => 'present',
            'recorded_by' => $this->teacherUser->id,
        ]);
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);

        return User::factory()->create(['role_id' => $role->id, 'is_active' => true, 'must_change_password' => false]);
    }
}
