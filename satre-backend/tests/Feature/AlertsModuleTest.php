<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Alert;
use App\Models\Classroom;
use App\Models\Guardian;
use App\Models\Intervention;
use App\Models\Monitor;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlertsModuleTest extends TestCase
{
    use RefreshDatabase;

    private Classroom $classroom;

    private Student $student;

    private User $teacherUser;

    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $this->adminUser = $this->userWithRole(Roles::ADMIN);
        $this->teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $this->teacherUser->id]);
        $this->classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);
        $this->student = Student::factory()->create([
            'classroom_id' => $this->classroom->id,
            'is_boarder' => true,
            'first_name' => 'Lucía',
            'last_name' => 'Quispe',
        ]);
    }

    public function test_teacher_lists_classroom_alerts_with_interventions(): void
    {
        $alert = $this->openAlert();
        $intervention = $alert->interventions()->create([
            'student_id' => $this->student->id,
            'type' => 'tutoria',
            'description' => 'Tutoría individual de recuperación.',
            'status' => Intervention::STATUS_PLANNED,
        ]);
        $intervention->followUps()->create([
            'student_id' => $this->student->id,
            'recorded_by' => $this->teacherUser->id,
            'follow_up_date' => now()->toDateString(),
            'outcome' => 'mejora',
            'notes' => 'Participó con más confianza.',
        ]);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson('/api/alerts?status=open')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.id', $alert->id)
            ->assertJsonPath('data.0.student.name', 'Lucía Quispe')
            ->assertJsonPath('data.0.title', 'Riesgo ALTO de deserción')
            ->assertJsonPath('data.0.interventions.0.type', 'tutoria')
            ->assertJsonPath('data.0.interventions.0.follow_ups.0.outcome', 'mejora');
    }

    public function test_teacher_cannot_see_alerts_of_another_classroom(): void
    {
        $other = Student::factory()->create([
            'classroom_id' => Classroom::factory()->create()->id,
            'is_boarder' => true,
        ]);
        $this->openAlert($other);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->getJson('/api/alerts')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_student_sees_own_reduced_alert_and_cannot_update(): void
    {
        $alert = $this->openAlert();
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $this->student->update(['user_id' => $studentUser->id]);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/alerts')
            ->assertOk()
            ->assertJsonPath('data.0.id', $alert->id)
            ->assertJsonPath('data.0.severity', 'ALTO')
            ->assertJsonPath('data.0.message', 'Intervención prioritaria.')
            ->assertJsonMissingPath('data.0.title')
            ->assertJsonMissingPath('data.0.interventions');

        $this->actingAs($studentUser, 'sanctum')
            ->patchJson("/api/alerts/{$alert->id}", ['status' => 'acknowledged'])
            ->assertForbidden();
    }

    public function test_guardian_sees_linked_child_alerts_only(): void
    {
        $this->openAlert();
        $guardianUser = $this->userWithRole(Roles::GUARDIAN);
        $guardian = Guardian::query()->create([
            'user_id' => $guardianUser->id,
            'document_number' => '22223333',
            'first_name' => 'Rosa',
            'last_name' => 'Huamán',
        ]);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson('/api/alerts')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $guardian->students()->attach($this->student->id);

        $this->actingAs($guardianUser, 'sanctum')
            ->getJson('/api/alerts')
            ->assertOk()
            ->assertJsonPath('data.0.student.name', 'Lucía Quispe');
    }

    public function test_monitor_sees_boarder_alerts_and_can_acknowledge(): void
    {
        $alert = $this->openAlert();
        $dayStudent = Student::factory()->create([
            'classroom_id' => $this->classroom->id,
            'is_boarder' => false,
        ]);
        $this->openAlert($dayStudent);
        $monitorUser = $this->monitorUser();

        $this->actingAs($monitorUser, 'sanctum')
            ->getJson('/api/alerts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $alert->id);

        $this->actingAs($monitorUser, 'sanctum')
            ->patchJson("/api/alerts/{$alert->id}", ['status' => Alert::STATUS_ACKNOWLEDGED])
            ->assertOk()
            ->assertJsonPath('data.status', 'acknowledged');

        $this->assertDatabaseHas('audit_logs', ['action' => 'alert.status_changed', 'auditable_id' => $alert->id]);
    }

    public function test_status_transitions_and_cannot_reopen(): void
    {
        $alert = $this->openAlert();

        $this->actingAs($this->teacherUser, 'sanctum')
            ->patchJson("/api/alerts/{$alert->id}", ['status' => Alert::STATUS_RESOLVED])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved');

        $this->actingAs($this->teacherUser, 'sanctum')
            ->patchJson("/api/alerts/{$alert->id}", ['status' => Alert::STATUS_OPEN])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_staff_registers_intervention_and_follow_up(): void
    {
        $alert = $this->openAlert();

        $interventionId = $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson("/api/alerts/{$alert->id}/interventions", [
                'type' => 'tutoria',
                'description' => 'Sesión de recuperación de criterio B.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.type', 'tutoria')
            ->json('data.id');

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson("/api/interventions/{$interventionId}/follow-ups", [
                'follow_up_date' => now()->toDateString(),
                'outcome' => 'mejora',
                'notes' => 'Avanzó en la guía de funciones.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.outcome', 'mejora');

        $this->assertDatabaseHas('interventions', ['alert_id' => $alert->id, 'type' => 'tutoria']);
        $this->assertDatabaseHas('follow_ups', ['intervention_id' => $interventionId, 'outcome' => 'mejora']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'intervention.created']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'follow_up.created']);
    }

    public function test_teacher_cannot_intervene_on_foreign_alert(): void
    {
        $other = Student::factory()->create(['classroom_id' => Classroom::factory()->create()->id]);
        $alert = $this->openAlert($other);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson("/api/alerts/{$alert->id}/interventions", [
                'type' => 'tutoria',
                'description' => 'No debería registrarse esta intervención.',
            ])
            ->assertForbidden();
    }

    public function test_intervention_validation(): void
    {
        $alert = $this->openAlert();

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson("/api/alerts/{$alert->id}/interventions", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type', 'description']);
    }

    private function openAlert(?Student $student = null): Alert
    {
        return Alert::query()->create([
            'student_id' => ($student ?? $this->student)->id,
            'type' => Alert::TYPE_RISK,
            'severity' => 'ALTO',
            'title' => 'Riesgo ALTO de deserción',
            'message' => 'Intervención prioritaria.',
            'status' => Alert::STATUS_OPEN,
        ]);
    }

    private function monitorUser(): User
    {
        $user = $this->userWithRole(Roles::MONITOR);
        Monitor::query()->create(['user_id' => $user->id, 'employee_code' => 'MON-1']);

        return $user;
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);

        return User::factory()->create([
            'role_id' => $role->id,
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
