<?php

namespace Tests\Feature\Admin;

use App\Models\Alert;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminMetricsAndAuditTest extends TestCase
{
    use InteractsWithAdmin, RefreshDatabase;

    public function test_metrics_without_data_return_200_with_insufficient_data(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/metrics')
            ->assertOk()
            ->assertJsonPath('data.users.active', 1)
            ->assertJsonPath('data.attendance_coverage.rate', null)
            ->assertJsonPath('data.attendance_coverage.insufficient_data', true)
            ->assertJsonPath('data.alerts.open', 0);
    }

    public function test_metrics_report_active_users_coverage_and_open_alerts(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $this->userWithRole(Roles::MONITOR, ['is_active' => false]);

        Attendance::factory()->create([
            'student_id' => $context['student']->id,
            'course_id' => $context['course']->id,
            'academic_period_id' => $context['period']->id,
            'attendance_date' => today()->toDateString(),
            'recorded_by' => $context['teacher']->user_id,
        ]);

        foreach (['open', 'open', 'resolved'] as $status) {
            Alert::query()->create([
                'student_id' => $context['student']->id,
                'type' => 'risk',
                'severity' => 'ALTO',
                'title' => 'Riesgo',
                'message' => 'Riesgo alto',
                'status' => $status,
            ]);
        }

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/metrics')
            ->assertOk()
            ->assertJsonPath('data.users.active', 2)
            ->assertJsonPath('data.users.inactive', 1)
            ->assertJsonPath('data.attendance_coverage.courses_total', 1)
            ->assertJsonPath('data.attendance_coverage.courses_with_attendance', 1)
            ->assertJsonPath('data.attendance_coverage.rate', 1)
            ->assertJsonPath('data.alerts.open', 2)
            ->assertJsonPath('data.alerts.open_by_severity.ALTO', 2);
    }

    public function test_audit_logs_are_paginated_and_filtered(): void
    {
        $admin = $this->admin();
        $other = $this->userWithRole(Roles::TEACHER);

        foreach (range(1, 16) as $i) {
            AuditLog::query()->create(['user_id' => $admin->id, 'action' => 'user.updated', 'created_at' => '2026-05-10 10:00:00']);
        }
        AuditLog::query()->create(['user_id' => $other->id, 'action' => 'attendance.recorded', 'created_at' => '2026-06-01 08:00:00']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.total', 17);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/audit-logs?user_id=$other->id")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.user.id', $other->id);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs?action=attendance.')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs?date_from=2026-05-01&date_to=2026-05-31')
            ->assertOk()
            ->assertJsonPath('meta.total', 16);
    }

    public function test_audit_logs_reject_inverted_date_range(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/audit-logs?date_from=2026-06-01&date_to=2026-05-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['date_to']);
    }

    public function test_non_admin_cannot_read_metrics_or_audit_logs(): void
    {
        $monitor = $this->userWithRole(Roles::MONITOR);

        $this->actingAs($monitor, 'sanctum')->getJson('/api/admin/metrics')->assertForbidden();
        $this->actingAs($monitor, 'sanctum')->getJson('/api/admin/audit-logs')->assertForbidden();
    }
}
