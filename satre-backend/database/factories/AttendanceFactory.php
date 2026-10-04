<?php

namespace Database\Factories;

use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Attendance>
 */
class AttendanceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'student_id' => Student::factory(),
            'course_id' => Course::factory(),
            'academic_period_id' => AcademicPeriod::factory(),
            'attendance_date' => '2026-03-16',
            'status' => 'present',
            'recorded_by' => User::factory(),
            'notes' => null,
        ];
    }

    public function late(): static
    {
        return $this->state(fn (array $attributes) => ['status' => 'late']);
    }

    public function absentJustified(): static
    {
        return $this->state(fn (array $attributes) => ['status' => 'absent_justified']);
    }

    public function absentUnjustified(): static
    {
        return $this->state(fn (array $attributes) => ['status' => 'absent_unjustified']);
    }
}
