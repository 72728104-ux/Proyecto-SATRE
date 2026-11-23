<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Student;
use App\Models\TutorSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TutorSession>
 */
class TutorSessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'student_id' => Student::factory(),
            'course_id' => Course::factory(),
            'topic' => 'Ecuaciones cuadráticas',
            'criterion' => 'A',
            'state' => ['step' => 'diagnostico'],
            'status' => TutorSession::STATUS_ACTIVE,
        ];
    }
}
