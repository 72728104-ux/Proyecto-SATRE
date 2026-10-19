<?php

namespace Database\Factories;

use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Teacher>
 */
class TeacherFactory extends Factory
{
    public function definition(): array
    {
        $dni = fake()->unique()->numerify('########');

        return [
            'user_id' => User::factory()->state(['dni' => $dni]),
            'employee_code' => strtoupper(fake()->unique()->bothify('DOC-####')),
            'dni' => $dni,
            'specialty' => 'Tutoría IB',
        ];
    }
}
