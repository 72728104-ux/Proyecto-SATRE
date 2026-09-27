<?php

namespace Database\Factories;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Teacher;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Course>
 */
class CourseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->bothify('CUR-##')),
            'name' => 'Matemáticas',
            'classroom_id' => Classroom::factory(),
            'teacher_id' => Teacher::factory(),
            'academic_period_id' => AcademicPeriod::factory(),
        ];
    }
}
