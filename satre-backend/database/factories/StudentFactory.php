<?php

namespace Database\Factories;

use App\Models\Classroom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Student>
 */
class StudentFactory extends Factory
{
    public function definition(): array
    {
        $dni = fake()->unique()->numerify('########');

        return [
            'user_id' => null,
            'student_code' => strtoupper(fake()->unique()->bothify('EST-####')),
            'document_number' => $dni,
            'dni' => $dni,
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'status' => 'active',
            'is_boarder' => true,
            'classroom_id' => Classroom::factory(),
        ];
    }

    public function withUser(): static
    {
        return $this->state(function (array $attributes) {
            $dni = $attributes['dni'] ?? $attributes['document_number'] ?? fake()->unique()->numerify('########');

            return [
                'dni' => $dni,
                'document_number' => $attributes['document_number'] ?? $dni,
                'user_id' => User::factory()->student()->state(['dni' => $dni]),
            ];
        });
    }
}
