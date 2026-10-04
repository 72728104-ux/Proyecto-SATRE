<?php

namespace Database\Factories;

use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Grade>
 */
class GradeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'student_id' => Student::factory(),
            'course_id' => Course::factory(),
            'academic_period_id' => AcademicPeriod::factory(),
            'evaluation_name' => 'Criterio '.fake()->randomElement(Grade::CRITERIA),
            'criterion' => fake()->randomElement(Grade::CRITERIA),
            'evaluation_date' => '2026-04-15',
            'score' => fake()->numberBetween(Grade::MIN_SCORE, Grade::MAX_SCORE),
            'max_score' => Grade::MAX_SCORE,
            'recorded_by' => User::factory(),
            'recorded_at' => now(),
        ];
    }
}
