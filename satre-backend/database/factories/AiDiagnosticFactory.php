<?php

namespace Database\Factories;

use App\Models\AcademicPeriod;
use App\Models\AiDiagnostic;
use App\Models\Classroom;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AiDiagnostic>
 */
class AiDiagnosticFactory extends Factory
{
    public function definition(): array
    {
        return [
            'type' => AiDiagnostic::TYPE_TEACHER_INSIGHT,
            'student_id' => null,
            'classroom_id' => Classroom::factory(),
            'academic_period_id' => AcademicPeriod::factory(),
            'payload' => [
                'gaps' => [
                    ['criterion' => 'C', 'below_passing_pct' => 42.0],
                ],
            ],
            'model_version' => 'rules-1.0',
            'insufficient_data' => false,
            'generated_at' => now(),
        ];
    }

    public function studentProfile(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => AiDiagnostic::TYPE_STUDENT_PROFILE,
        ]);
    }
}
