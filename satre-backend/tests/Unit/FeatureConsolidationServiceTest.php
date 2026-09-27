<?php

namespace Tests\Unit;

use App\Models\AcademicPeriod;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Services\FeatureConsolidationService;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeatureConsolidationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_calculates_attendance_and_tardiness_rates(): void
    {
        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $role = Role::factory()->create(['slug' => Roles::TEACHER]);
        $user = User::factory()->create(['role_id' => $role->id]);
        $teacher = Teacher::factory()->create(['user_id' => $user->id]);
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

        Attendance::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'academic_period_id' => $period->id,
            'attendance_date' => '2026-03-16',
            'status' => 'present',
            'recorded_by' => $user->id,
        ]);
        Attendance::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'academic_period_id' => $period->id,
            'attendance_date' => '2026-03-17',
            'status' => 'late',
            'recorded_by' => $user->id,
        ]);

        $snapshot = app(FeatureConsolidationService::class)->consolidate($student, $period);

        $this->assertEquals(1.0, (float) $snapshot->attendance_rate);
        $this->assertEquals(0.5, (float) $snapshot->tardiness_rate);
        $this->assertSame($student->id, $snapshot->student_id);
    }
}
