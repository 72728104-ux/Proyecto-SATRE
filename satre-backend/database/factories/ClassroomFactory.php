<?php

namespace Database\Factories;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Teacher;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Classroom>
 */
class ClassroomFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => '5to A',
            'grade_level' => '5to',
            'capacity' => 24,
            'academic_period_id' => AcademicPeriod::factory(),
            'tutor_id' => Teacher::factory(),
        ];
    }
}
