<?php

namespace Tests\Feature;

use App\Support\InstitutionalIdentity;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\InstitutionalUserSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederEnvironmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_development_seeders_are_skipped_in_production(): void
    {
        $this->app['env'] = 'production';

        (new DatabaseSeeder)->run();
        (new InstitutionalUserSeeder)->run();

        $this->assertDatabaseMissing('users', ['email' => InstitutionalIdentity::ADMIN_EMAIL]);
        $this->assertDatabaseMissing('users', ['email' => InstitutionalIdentity::seededTeacherEmail()]);
        $this->assertDatabaseMissing('users', ['email' => InstitutionalIdentity::MONITOR_EMAIL]);
        $this->assertDatabaseMissing('users', ['email' => InstitutionalIdentity::seededStudentEmail()]);
        $this->assertDatabaseMissing('users', ['email' => InstitutionalIdentity::GUARDIAN_EMAIL]);
    }

    public function test_institutional_user_seeder_runs_in_testing(): void
    {
        $this->seed([RoleSeeder::class, InstitutionalUserSeeder::class]);

        $this->assertDatabaseHas('users', [
            'email' => InstitutionalIdentity::ADMIN_EMAIL,
            'dni' => InstitutionalIdentity::ADMIN_DNI,
        ]);
        $this->assertDatabaseHas('users', [
            'email' => InstitutionalIdentity::seededTeacherEmail(),
            'dni' => InstitutionalIdentity::TEACHER_DNI,
        ]);
        $this->assertDatabaseHas('users', [
            'email' => InstitutionalIdentity::seededStudentEmail(),
            'dni' => InstitutionalIdentity::STUDENT_DNI,
        ]);
        $this->assertDatabaseHas('teachers', ['dni' => InstitutionalIdentity::TEACHER_DNI]);
        $this->assertDatabaseHas('students', ['dni' => InstitutionalIdentity::STUDENT_DNI]);
    }
}
