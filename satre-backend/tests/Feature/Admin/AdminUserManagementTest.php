<?php

namespace Tests\Feature\Admin;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminUserManagementTest extends TestCase
{
    use InteractsWithAdmin, RefreshDatabase;

    public function test_non_admin_cannot_manage_users(): void
    {
        $this->actingAs($this->userWithRole(Roles::TEACHER), 'sanctum')
            ->getJson('/api/admin/users')
            ->assertForbidden();
    }

    public function test_admin_lists_users_paginated_and_filtered(): void
    {
        $admin = $this->admin();
        User::factory()->count(20)->create();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 21);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?role=admin')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_user_listing_exposes_profile_id_for_assignment_pickers(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Ana Rojas',
            'email' => 'ana@coar.edu.pe',
            'role' => Roles::TEACHER,
            'profile' => ['employee_code' => 'DOC-0101'],
        ])->assertCreated();
        $teacher = User::query()->where('email', 'ana@coar.edu.pe')->firstOrFail()->teacher;

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?role=teacher')
            ->assertOk()
            ->assertJsonPath('data.0.profile_id', $teacher->id);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?role=admin')
            ->assertJsonPath('data.0.profile_id', null);
    }

    public function test_admin_creates_teacher_with_profile_and_temporary_password(): void
    {
        $admin = $this->admin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'Ana Rojas',
                'email' => 'ana@coar.edu.pe',
                'role' => Roles::TEACHER,
                'profile' => ['employee_code' => 'DOC-0100', 'specialty' => 'Física'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::TEACHER)
            ->assertJsonPath('data.must_change_password', true);

        $user = User::query()->where('email', 'ana@coar.edu.pe')->firstOrFail();
        $this->assertTrue(Hash::check($response->json('temporary_password'), $user->password));
        $this->assertDatabaseHas('teachers', ['user_id' => $user->id, 'employee_code' => 'DOC-0100']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created', 'auditable_id' => $user->id, 'user_id' => $admin->id]);
    }

    public function test_student_user_requires_profile(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->postJson('/api/admin/users', [
                'name' => 'Sin Perfil',
                'email' => 'sin.perfil@coar.edu.pe',
                'role' => Roles::STUDENT,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['profile', 'profile.student_code', 'profile.document_number']);
    }

    public function test_admin_updates_user_and_audits_old_and_new_values(): void
    {
        $admin = $this->admin();
        $user = $this->userWithRole(Roles::MONITOR, ['name' => 'Nombre Viejo']);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/users/$user->id", ['name' => 'Nombre Nuevo'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Nombre Nuevo');

        $log = AuditLog::query()->where('action', 'user.updated')->where('auditable_id', $user->id)->firstOrFail();
        $this->assertSame(['name' => 'Nombre Viejo'], $log->old_values);
        $this->assertSame(['name' => 'Nombre Nuevo'], $log->new_values);
    }

    public function test_toggle_active_deactivates_user_and_revokes_tokens(): void
    {
        $admin = $this->admin();
        $user = $this->userWithRole(Roles::TEACHER);
        $user->createToken('web');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/users/$user->id/toggle-active")
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.active_toggled', 'auditable_id' => $user->id]);
    }

    public function test_admin_cannot_deactivate_or_reset_own_account(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/users/$admin->id/toggle-active")
            ->assertStatus(422);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/$admin->id/reset-password")
            ->assertStatus(422);
    }

    public function test_reset_password_issues_temporary_password_and_forces_change(): void
    {
        $admin = $this->admin();
        $user = $this->userWithRole(Roles::TEACHER, ['must_change_password' => false]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/$user->id/reset-password")
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $this->assertTrue(Hash::check($response->json('temporary_password'), $user->fresh()->password));
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.password_reset_by_admin', 'auditable_id' => $user->id]);
    }

    public function test_user_with_profile_cannot_be_deleted(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson('/api/admin/users/'.$context['teacher']->user_id)
            ->assertStatus(422);

        $plain = $this->userWithRole(Roles::ADMIN);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/users/$plain->id")
            ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $plain->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.deleted', 'auditable_id' => $plain->id]);
    }
}
