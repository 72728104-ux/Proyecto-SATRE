<?php

namespace Database\Seeders;

use App\Models\Guardian;
use App\Models\Monitor;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\InstitutionalIdentity;
use App\Support\Roles;
use Illuminate\Database\Seeder;
use RuntimeException;

class InstitutionalUserSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $secret = (string) config('satre.seed_secret');
        if ($secret === '') {
            throw new RuntimeException('SATRE_SEED_SECRET must be set to seed local users.');
        }
        $seedAuth = [
            'password' => $secret,
            'must_change_password' => false,
            'password_changed_at' => now(),
            'is_active' => true,
        ];

        $this->upsertUser(
            InstitutionalIdentity::ADMIN_DNI,
            InstitutionalIdentity::ADMIN_EMAIL,
            ['admin@coar.edu.pe'],
            [
                'name' => 'Rosa Huamán Quispe',
                'role_id' => Role::query()->where('slug', Roles::ADMIN)->value('id'),
                ...$seedAuth,
            ]
        );

        $teacherUser = $this->upsertUser(
            InstitutionalIdentity::TEACHER_DNI,
            InstitutionalIdentity::seededTeacherEmail(),
            ['tutor@coar.edu.pe'],
            [
                'name' => 'Luis Mendoza Aliaga',
                'role_id' => Role::query()->where('slug', Roles::TEACHER)->value('id'),
                ...$seedAuth,
            ]
        );
        Teacher::query()->updateOrCreate(
            ['user_id' => $teacherUser->id],
            [
                'employee_code' => 'DOC-0001',
                'dni' => InstitutionalIdentity::TEACHER_DNI,
                'specialty' => 'Tutoría IB',
            ]
        );

        $monitorUser = $this->upsertUser(
            InstitutionalIdentity::MONITOR_DNI,
            InstitutionalIdentity::MONITOR_EMAIL,
            ['residencia@coar.edu.pe'],
            [
                'name' => 'Carla Palomino Rojas',
                'role_id' => Role::query()->where('slug', Roles::MONITOR)->value('id'),
                ...$seedAuth,
            ]
        );
        Monitor::query()->updateOrCreate(
            ['user_id' => $monitorUser->id],
            ['employee_code' => 'MON-0001']
        );

        $studentUser = $this->upsertUser(
            InstitutionalIdentity::STUDENT_DNI,
            InstitutionalIdentity::seededStudentEmail(),
            ['estudiante@coar.edu.pe'],
            [
                'name' => 'Valeria Chávez Poma',
                'role_id' => Role::query()->where('slug', Roles::STUDENT)->value('id'),
                ...$seedAuth,
            ]
        );
        Student::query()->updateOrCreate(
            ['user_id' => $studentUser->id],
            [
                'student_code' => 'EST-0003',
                'document_number' => InstitutionalIdentity::STUDENT_DNI,
                'dni' => InstitutionalIdentity::STUDENT_DNI,
                'first_name' => 'Valeria',
                'last_name' => 'Chávez Poma',
                'status' => 'active',
                'is_boarder' => true,
            ]
        );

        $guardianUser = $this->upsertUser(
            InstitutionalIdentity::GUARDIAN_DNI,
            InstitutionalIdentity::GUARDIAN_EMAIL,
            ['apoderado@coar.edu.pe'],
            [
                'name' => 'Héctor Chávez Ramos',
                'role_id' => Role::query()->where('slug', Roles::GUARDIAN)->value('id'),
                ...$seedAuth,
            ]
        );
        $guardian = Guardian::query()->updateOrCreate(
            ['user_id' => $guardianUser->id],
            [
                'document_number' => InstitutionalIdentity::GUARDIAN_DNI,
                'first_name' => 'Héctor',
                'last_name' => 'Chávez Ramos',
                'phone' => '964000000',
                'email' => InstitutionalIdentity::GUARDIAN_EMAIL,
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

    /**
     * @param  list<string>  $legacyEmails
     * @param  array<string, mixed>  $attributes
     */
    private function upsertUser(string $dni, string $email, array $legacyEmails, array $attributes): User
    {
        $user = User::query()
            ->where('dni', $dni)
            ->orWhere('email', $email)
            ->orWhereIn('email', $legacyEmails)
            ->first();

        $payload = ['dni' => $dni, 'email' => $email, ...$attributes];

        if ($user) {
            $user->fill($payload)->save();

            return $user;
        }

        return User::query()->create($payload);
    }
}
