<?php

namespace Tests\Feature\Admin;

use App\Models\Enrollment;
use App\Models\Guardian;
use App\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AdminEnrollmentAndGuardianTest extends TestCase
{
    use InteractsWithAdmin, RefreshDatabase;

    public function test_admin_enrolls_student_individually(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/enrollments', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.student.id', $context['student']->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.created']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/enrollments', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
            ])
            ->assertStatus(422);
    }

    public function test_delete_withdraws_enrollment_and_post_reactivates_it(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $enrollment = Enrollment::factory()->create(['student_id' => $context['student']->id, 'course_id' => $context['course']->id]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/enrollments/$enrollment->id")
            ->assertOk()
            ->assertJsonPath('data.status', 'withdrawn');

        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.withdrawn', 'auditable_id' => $enrollment->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/enrollments', [
                'student_id' => $context['student']->id,
                'course_id' => $context['course']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.id', $enrollment->id)
            ->assertJsonPath('data.status', 'active');
    }

    public function test_bulk_csv_enrolls_creates_and_skips_existing(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $second = Student::factory()->create(['classroom_id' => $context['classroom']->id, 'student_code' => 'EST-0002']);
        Enrollment::factory()->create(['student_id' => $second->id, 'course_id' => $context['course']->id]);

        $csv = "\xEF\xBB\xBFstudent_code,course_code\nEST-0001,MAT-AA\nEST-0002,MAT-AA\nEST-0001,MAT-AA\n";

        $this->actingAs($admin, 'sanctum')
            ->post('/api/admin/enrollments/bulk', [
                'file' => UploadedFile::fake()->createWithContent('matriculas.csv', $csv),
                'academic_period_id' => $context['period']->id,
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.skipped', 2);

        $this->assertDatabaseHas('enrollments', ['student_id' => $context['student']->id, 'course_id' => $context['course']->id, 'status' => 'active']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.imported']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.bulk_imported']);
    }

    public function test_bulk_csv_with_invalid_row_writes_nothing(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $csv = "student_code;course_code\nEST-0001;MAT-AA\nEST-9999;MAT-AA\n";

        $this->actingAs($admin, 'sanctum')
            ->post('/api/admin/enrollments/bulk', [
                'file' => UploadedFile::fake()->createWithContent('matriculas.csv', $csv),
                'academic_period_id' => $context['period']->id,
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['rows.3']);

        $this->assertDatabaseCount('enrollments', 0);
    }

    public function test_bulk_csv_requires_expected_columns(): void
    {
        $context = $this->academicContext();

        $this->actingAs($this->admin(), 'sanctum')
            ->post('/api/admin/enrollments/bulk', [
                'file' => UploadedFile::fake()->createWithContent('matriculas.csv', "codigo,curso\nEST-0001,MAT-AA\n"),
                'academic_period_id' => $context['period']->id,
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_admin_links_guardian_to_student_as_primary(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $guardian = Guardian::query()->create(['document_number' => '40000001', 'first_name' => 'Rosa', 'last_name' => 'Poma']);
        $previous = Guardian::query()->create(['document_number' => '40000002', 'first_name' => 'Juan', 'last_name' => 'Poma']);
        $previous->students()->attach($context['student']->id, ['relationship' => 'padre', 'is_primary' => true]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/guardians/$guardian->id/students", [
                'student_id' => $context['student']->id,
                'relationship' => 'madre',
                'is_primary' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.students.0.id', $context['student']->id)
            ->assertJsonPath('data.students.0.is_primary', true);

        $this->assertDatabaseHas('guardian_student', ['guardian_id' => $previous->id, 'student_id' => $context['student']->id, 'is_primary' => false]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'guardian.student_linked', 'auditable_id' => $guardian->id]);
    }
}
