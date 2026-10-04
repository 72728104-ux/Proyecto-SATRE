<?php

namespace Database\Factories;

use App\Models\Incident;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Incident>
 */
class IncidentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'student_id' => Student::factory(),
            'reported_by' => User::factory()->monitor(),
            'incident_at' => now()->subDays(3),
            'category' => fake()->randomElement(Incident::CATEGORIES),
            'severity' => fake()->randomElement(Incident::SEVERITIES),
            'description' => fake()->sentence(),
            'status' => 'open',
            'resolved_at' => null,
        ];
    }

    public function resolved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);
    }
}
