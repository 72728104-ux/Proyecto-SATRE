<?php

namespace Database\Factories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Role>
 */
class RoleFactory extends Factory
{
    public function definition(): array
    {
        $slug = fake()->unique()->lexify('role_????');

        return [
            'slug' => $slug,
            'name' => $slug,
            'description' => fake()->sentence(),
        ];
    }
}
