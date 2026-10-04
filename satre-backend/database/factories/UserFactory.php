<?php

namespace Database\Factories;

use App\Models\Role;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        $role = Role::query()->firstOrCreate(
            ['slug' => Roles::TEACHER],
            ['name' => 'Docente', 'description' => 'Docente o tutor académico']
        );

        return [
            'role_id' => $role->id,
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'is_active' => true,
            'must_change_password' => false,
            'password_changed_at' => now(),
            'remember_token' => Str::random(10),
        ];
    }

    public function admin(): static
    {
        return $this->forRole(Roles::ADMIN, 'Administrador', 'Gestión institucional');
    }

    public function teacher(): static
    {
        return $this->forRole(Roles::TEACHER, 'Docente', 'Docente o tutor académico');
    }

    public function monitor(): static
    {
        return $this->forRole(Roles::MONITOR, 'Monitor de residencia', 'Presencia residencial e incidencias');
    }

    public function student(): static
    {
        return $this->forRole(Roles::STUDENT, 'Estudiante', 'Consulta de información propia');
    }

    public function guardian(): static
    {
        return $this->forRole(Roles::GUARDIAN, 'Apoderado', 'Autorización de permisos');
    }

    public function mustChangePassword(): static
    {
        return $this->state(fn (array $attributes) => [
            'must_change_password' => true,
            'password_changed_at' => null,
        ]);
    }

    private function forRole(string $slug, string $name, string $description): static
    {
        return $this->state(function () use ($slug, $name, $description) {
            $role = Role::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'description' => $description]
            );

            return ['role_id' => $role->id];
        });
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
