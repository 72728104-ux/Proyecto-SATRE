<?php

namespace Tests\Feature\Admin;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;

trait InteractsWithAdmin
{
    protected function userWithRole(string $slug, array $attributes = []): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);

        return User::factory()->create($attributes + ['role_id' => $role->id, 'is_active' => true]);
    }

    protected function admin(): User
    {
        foreach (Roles::all() as $slug) {
            Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);
        }

        return $this->userWithRole(Roles::ADMIN);
    }

    /**
     * @return array{period: AcademicPeriod, teacher: Teacher, classroom: Classroom, course: Course, student: Student}
     */
    protected function academicContext(): array
    {
        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $teacher = Teacher::factory()->create(['user_id' => $this->userWithRole(Roles::TEACHER)->id]);
        $classroom = Classroom::factory()->create(['academic_period_id' => $period->id, 'tutor_id' => $teacher->id]);
        $course = Course::factory()->create([
            'code' => 'MAT-AA',
            'classroom_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'academic_period_id' => $period->id,
        ]);
        $student = Student::factory()->create(['classroom_id' => $classroom->id, 'student_code' => 'EST-0001']);

        return compact('period', 'teacher', 'classroom', 'course', 'student');
    }
}
