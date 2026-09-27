<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Support\Roles;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            Roles::ADMIN => ['name' => 'Administrador', 'description' => 'Gestión institucional, usuarios, auditoría y configuración.'],
            Roles::TEACHER => ['name' => 'Docente / Tutor', 'description' => 'Procesos académicos de aula, asistencia y calificaciones.'],
            Roles::MONITOR => ['name' => 'Monitor de residencia', 'description' => 'Presencia residencial, incidencias y permisos.'],
            Roles::STUDENT => ['name' => 'Estudiante', 'description' => 'Consulta de su información académica y residencial.'],
            Roles::GUARDIAN => ['name' => 'Apoderado', 'description' => 'Autorización de permisos y seguimiento del estudiante.'],
        ];

        foreach ($roles as $slug => $data) {
            Role::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => $data['name'], 'description' => $data['description']]
            );
        }
    }
}
