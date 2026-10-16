<?php

namespace Database\Seeders;

use App\Models\Guardian;
use App\Models\Monitor;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Database\Seeder;

class DemoUserSeeder extends Seeder
{
    public function run(): void
    {
        $password = 'coar2026';
        $demoAuth = [
            'password' => $password,
            'must_change_password' => false,
            'password_changed_at' => now(),
            'is_active' => true,
        ];

        User::query()->updateOrCreate(
            ['email' => 'admin@coar.edu.pe'],
            [
                'name' => 'Rosa Huamán Quispe',
                'role_id' => Role::query()->where('slug', Roles::ADMIN)->value('id'),
                ...$demoAuth,
            ]
        );

        $teacherUser = User::query()->updateOrCreate(
            ['email' => 'tutor@coar.edu.pe'],
            [
                'name' => 'Luis Mendoza Aliaga',
                'role_id' => Role::query()->where('slug', Roles::TEACHER)->value('id'),
                ...$demoAuth,
            ]
        );
        Teacher::query()->updateOrCreate(
            ['user_id' => $teacherUser->id],
            ['employee_code' => 'DOC-0001', 'specialty' => 'Tutoría IB']
        );

        $monitorUser = User::query()->updateOrCreate(
            ['email' => 'residencia@coar.edu.pe'],
            [
                'name' => 'Carla Palomino Rojas',
                'role_id' => Role::query()->where('slug', Roles::MONITOR)->value('id'),
                ...$demoAuth,
            ]
        );
        Monitor::query()->updateOrCreate(
            ['user_id' => $monitorUser->id],
            ['employee_code' => 'MON-0001']
        );

        $studentUser = User::query()->updateOrCreate(
            ['email' => 'estudiante@coar.edu.pe'],
            [
                'name' => 'Valeria Chávez Poma',
                'role_id' => Role::query()->where('slug', Roles::STUDENT)->value('id'),
                ...$demoAuth,
            ]
        );
        Student::query()->updateOrCreate(
            ['user_id' => $studentUser->id],
            [
                'student_code' => 'EST-0003',
                'document_number' => '78901234',
                'first_name' => 'Valeria',
                'last_name' => 'Chávez Poma',
                'status' => 'active',
                'is_boarder' => true,
            ]
        );

        $guardianUser = User::query()->updateOrCreate(
            ['email' => 'apoderado@coar.edu.pe'],
            [
                'name' => 'Héctor Chávez Ramos',
                'role_id' => Role::query()->where('slug', Roles::GUARDIAN)->value('id'),
                ...$demoAuth,
            ]
        );
        $guardian = Guardian::query()->updateOrCreate(
            ['user_id' => $guardianUser->id],
            [
                'document_number' => '10101010',
                'first_name' => 'Héctor',
                'last_name' => 'Chávez Ramos',
                'phone' => '964000000',
                'email' => 'apoderado@coar.edu.pe',
            ]
        );

        $student = Student::query()->where('user_id', $studentUser->id)->first();
        if ($student && ! $guardian->students()->where('students.id', $student->id)->exists()) {
            $guardian->students()->attach($student->id, [
                'relationship' => 'padre',
                'is_primary' => true,
            ]);
        }
    }
}
