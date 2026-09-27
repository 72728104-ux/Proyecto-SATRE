<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Classroom;
use App\Models\ResidentialPresence;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ResidenceModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_monitor_lists_active_boarders_with_presence_of_the_night(): void
    {
        $monitor = $this->userWithRole(Roles::MONITOR);
        $classroom = Classroom::factory()->create();
        $boarder = Student::factory()->create(['first_name' => 'Ana', 'last_name' => 'Quispe', 'classroom_id' => $classroom->id]);
        Student::factory()->create(['first_name' => 'Beto', 'last_name' => 'Rojas']);
        Student::factory()->create(['is_boarder' => false]);
        Student::factory()->create(['status' => 'withdrawn']);
        ResidentialPresence::query()->create([
            'student_id' => $boarder->id,
            'presence_date' => '2026-04-15',
            'check_type' => 'night',
            'status' => 'absent',
            'recorded_by' => $monitor->id,
        ]);

        $this->actingAs($monitor, 'sanctum')
            ->getJson('/api/residents?presence_date=2026-04-15&check_type=night')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.id', $boarder->id)
            ->assertJsonPath('data.0.classroom.name', $classroom->name)
            ->assertJsonPath('data.0.presence.status', 'absent')
            ->assertJsonPath('data.1.presence', null);

        $this->actingAs($monitor, 'sanctum')
            ->getJson('/api/residents?search=Quis')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonMissingPath('data.0.presence');

        $this->actingAs($monitor, 'sanctum')->getJson('/api/residents?check_type=noon')->assertStatus(422);
        $this->actingAs($this->userWithRole(Roles::ADMIN), 'sanctum')->getJson('/api/residents')->assertOk();
        $this->actingAs($this->userWithRole(Roles::TEACHER), 'sanctum')->getJson('/api/residents')->assertForbidden();
    }

    public function test_monitor_records_night_checklist_in_bulk_and_changes_are_audited(): void
    {
        $monitor = $this->userWithRole(Roles::MONITOR);
        [$first, $second] = Student::factory()->count(2)->create();
        $existing = ResidentialPresence::query()->create([
            'student_id' => $first->id,
            'presence_date' => '2026-04-15',
            'check_type' => 'night',
            'status' => 'present',
            'recorded_by' => $monitor->id,
        ]);

        $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/presences/bulk', [
                'presence_date' => '2026-04-15',
                'check_type' => 'night',
                'records' => [
                    ['student_id' => $first->id, 'status' => 'absent', 'notes' => 'No llegó al pabellón'],
                    ['student_id' => $second->id, 'status' => 'on_permission'],
                ],
            ])
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $existing->id)
            ->assertJsonPath('data.0.status', 'absent')
            ->assertJsonPath('data.1.status', 'on_permission');

        $this->assertSame(2, ResidentialPresence::query()->count());
        $log = AuditLog::query()->where('action', 'presence.updated')->firstOrFail();
        $this->assertSame('present', $log->old_values['status']);
        $this->assertSame('absent', $log->new_values['status']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'presence.recorded']);

        $this->actingAs($monitor, 'sanctum')
            ->getJson('/api/presences?presence_date=2026-04-15&check_type=night&status=absent')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.student_id', $first->id);
    }

    public function test_bulk_presence_rejects_non_boarders_without_saving_and_is_monitor_only(): void
    {
        $monitor = $this->userWithRole(Roles::MONITOR);
        $boarder = Student::factory()->create();
        $dayStudent = Student::factory()->create(['is_boarder' => false]);
        $payload = [
            'presence_date' => '2026-04-15',
            'check_type' => 'night',
            'records' => [
                ['student_id' => $boarder->id, 'status' => 'present'],
                ['student_id' => $dayStudent->id, 'status' => 'present'],
            ],
        ];

        $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/presences/bulk', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['records.1.student_id']);
        $this->assertSame(0, ResidentialPresence::query()->count());

        $this->actingAs($monitor, 'sanctum')
            ->postJson('/api/presences/bulk', ['records' => []] + $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['records']);

        $this->actingAs($this->userWithRole(Roles::ADMIN), 'sanctum')
            ->postJson('/api/presences/bulk', $payload)
            ->assertForbidden();
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);

        return User::factory()->create(['role_id' => $role->id, 'is_active' => true]);
    }
}
