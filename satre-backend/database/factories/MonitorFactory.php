<?php

namespace Database\Factories;

use App\Models\Monitor;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Monitor>
 */
class MonitorFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->monitor(),
            'employee_code' => strtoupper(fake()->unique()->bothify('MON-####')),
        ];
    }
}
