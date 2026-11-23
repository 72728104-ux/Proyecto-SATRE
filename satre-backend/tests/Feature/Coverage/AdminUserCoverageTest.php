<?php

namespace Tests\Feature\Coverage;

use App\Models\Classroom;
use App\Models\Guardian;
use App\Models\Monitor;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Admin\InteractsWithAdmin;
use Tests\TestCase;

/**
 * Cubre la creación de perfiles monitor/estudiante/apoderado y la
 * propagación de DNI a los perfiles vinculados.
 */
class AdminUserCoverageTest extends TestCase
{
    use InteractsWithAdmin, RefreshDatabase;

    private const USERS_ENDPOINT = '/api/admin/users';

    public function test_admin_creates_monitor_student_and_guardian_profiles(): void
    {
        $admin = $this->admin();
        $period = \App\Models\AcademicPeriod::factory()->create(['is_current' => true]);
        $classroom = Classroom::factory()->create(['academic_period_id' => $period->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::USERS_ENDPOINT, [
                'name' => 'Mónica Monitor',
                'email' => 'monitor@coar.edu.pe',
                'dni' => '11112222',
                'role' => Roles::MONITOR,
                'profile' => ['employee_code' => 'MON-9001'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::MONITOR);

        $monitorUser = User::query()->where('email', 'monitor@coar.edu.pe')->firstOrFail();
        $this->assertDatabaseHas('monitors', [
            'user_id' => $monitorUser->id,
            'employee_code' => 'MON-9001',
        ]);
        $this->assertSame($monitorUser->id, Monitor::query()->where('employee_code', 'MON-9001')->firstOrFail()->user->id);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::USERS_ENDPOINT, [
                'name' => 'Sofía Estudiante',
                'email' => 'estudiante.nuevo@coar.edu.pe',
                'dni' => '22223333',
                'role' => Roles::STUDENT,
                'profile' => [
                    'student_code' => 'EST-9001',
                    'document_number' => 'DOC-9001',
                    'first_name' => 'Sofía',
                    'last_name' => 'Quispe',
                    'classroom_id' => $classroom->id,
                    'is_boarder' => false,
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::STUDENT);

        $studentUser = User::query()->where('email', 'estudiante.nuevo@coar.edu.pe')->firstOrFail();
        $student = Student::query()->where('student_code', 'EST-9001')->firstOrFail();
        $this->assertSame($studentUser->id, $student->user_id);
        $this->assertSame($classroom->id, $student->classroom_id);
        $this->assertFalse($student->is_boarder);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::USERS_ENDPOINT, [
                'name' => 'Gloria Apoderada',
                'email' => 'apoderada@coar.edu.pe',
                'dni' => '33334444',
                'role' => Roles::GUARDIAN,
                'profile' => [
                    'document_number' => 'DOC-9002',
                    'first_name' => 'Gloria',
                    'last_name' => 'Poma',
                    'phone' => '999888777',
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::GUARDIAN);

        $guardianUser = User::query()->where('email', 'apoderada@coar.edu.pe')->firstOrFail();
        $guardian = Guardian::query()->where('document_number', 'DOC-9002')->firstOrFail();
        $this->assertSame($guardianUser->id, $guardian->user_id);
        $this->assertSame('999888777', $guardian->phone);
        $this->assertSame('apoderada@coar.edu.pe', $guardian->email);

        $this->actingAs($admin, 'sanctum')
            ->postJson(self::USERS_ENDPOINT, [
                'name' => 'Admin Sin Perfil',
                'email' => 'admin.nuevo@coar.edu.pe',
                'dni' => '44445555',
                'role' => Roles::ADMIN,
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::ADMIN);
    }

    public function test_updating_dni_propagates_to_teacher_and_student_profiles(): void
    {
        $admin = $this->admin();

        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create([
            'user_id' => $teacherUser->id,
            'dni' => '55556666',
        ]);
        $teacherUser->forceFill(['dni' => '55556666'])->save();

        $this->actingAs($admin, 'sanctum')
            ->putJson(self::USERS_ENDPOINT.'/'.$teacherUser->id, ['dni' => '55557777'])
            ->assertOk()
            ->assertJsonPath('data.dni', '55557777');

        $this->assertSame('55557777', $teacher->fresh()->dni);

        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student = Student::factory()->create([
            'user_id' => $studentUser->id,
            'dni' => '66667777',
            'document_number' => '66667777',
        ]);
        $studentUser->forceFill(['dni' => '66667777'])->save();

        $this->actingAs($admin, 'sanctum')
            ->putJson(self::USERS_ENDPOINT.'/'.$studentUser->id, ['dni' => '66668888'])
            ->assertOk()
            ->assertJsonPath('data.dni', '66668888');

        $this->assertSame('66668888', $student->fresh()->dni);
    }
}
