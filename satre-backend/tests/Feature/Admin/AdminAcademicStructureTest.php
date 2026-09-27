<?php

namespace Tests\Feature\Admin;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Enrollment;
use App\Models\Teacher;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAcademicStructureTest extends TestCase
{
    use InteractsWithAdmin, RefreshDatabase;

    public function test_admin_creates_classroom_with_tutor(): void
    {
        $admin = $this->admin();
        $period = AcademicPeriod::factory()->create();
        $teacher = Teacher::factory()->create(['user_id' => $this->userWithRole(Roles::TEACHER)->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/classrooms', [
                'name' => '4to B',
                'grade_level' => '4to',
                'capacity' => 25,
                'academic_period_id' => $period->id,
                'tutor_id' => $teacher->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.tutor.id', $teacher->id)
            ->assertJsonPath('data.academic_period.id', $period->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'classroom.created']);
    }

    public function test_admin_reassigns_classroom_tutor_with_audit(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $newTutor = Teacher::factory()->create(['user_id' => $this->userWithRole(Roles::TEACHER)->id]);

        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/admin/classrooms/'.$context['classroom']->id, ['tutor_id' => $newTutor->id])
            ->assertOk()
            ->assertJsonPath('data.tutor.id', $newTutor->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'classroom.updated', 'auditable_id' => $context['classroom']->id]);
    }

    public function test_classroom_with_courses_cannot_be_deleted(): void
    {
        $context = $this->academicContext();

        $this->actingAs($this->admin(), 'sanctum')
            ->deleteJson('/api/admin/classrooms/'.$context['classroom']->id)
            ->assertStatus(422);
    }

    public function test_admin_creates_course_assigning_teacher_classroom_and_period(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/courses', [
                'code' => 'FIS-HL',
                'name' => 'Física HL',
                'classroom_id' => $context['classroom']->id,
                'teacher_id' => $context['teacher']->id,
                'academic_period_id' => $context['period']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.teacher.id', $context['teacher']->id)
            ->assertJsonPath('data.classroom.id', $context['classroom']->id)
            ->assertJsonPath('data.academic_period.id', $context['period']->id);

        $this->assertDatabaseHas('audit_logs', ['action' => 'course.created']);
    }

    public function test_course_rejects_classroom_from_other_period_and_duplicate_code(): void
    {
        $admin = $this->admin();
        $context = $this->academicContext();
        $otherPeriod = AcademicPeriod::factory()->create(['name' => '2026-II', 'is_current' => false]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/courses', [
                'code' => 'QUI-SL',
                'name' => 'Química SL',
                'classroom_id' => $context['classroom']->id,
                'teacher_id' => $context['teacher']->id,
                'academic_period_id' => $otherPeriod->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['classroom_id']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/courses', [
                'code' => 'MAT-AA',
                'name' => 'Duplicado',
                'classroom_id' => $context['classroom']->id,
                'teacher_id' => $context['teacher']->id,
                'academic_period_id' => $context['period']->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_course_with_enrollments_cannot_be_deleted(): void
    {
        $context = $this->academicContext();
        Enrollment::factory()->create(['student_id' => $context['student']->id, 'course_id' => $context['course']->id]);

        $this->actingAs($this->admin(), 'sanctum')
            ->deleteJson('/api/admin/courses/'.$context['course']->id)
            ->assertStatus(422);
    }

    public function test_admin_lists_courses_paginated(): void
    {
        $context = $this->academicContext();

        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/courses?academic_period_id='.$context['period']->id)
            ->assertOk()
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.teacher.id', $context['teacher']->id);
    }

    public function test_admin_creates_period_and_validates_dates(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/periods', ['name' => '2027-I', 'start_date' => '2027-03-01', 'end_date' => '2027-02-01'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/periods', ['name' => '2027-I', 'start_date' => '2027-03-01', 'end_date' => '2027-07-31'])
            ->assertCreated()
            ->assertJsonPath('data.is_current', false);

        $this->assertDatabaseHas('audit_logs', ['action' => 'period.created']);
    }

    public function test_set_current_leaves_a_single_current_period(): void
    {
        $admin = $this->admin();
        $current = AcademicPeriod::factory()->create(['is_current' => true]);
        $next = AcademicPeriod::factory()->create(['name' => '2026-II', 'is_current' => false]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/periods/$next->id/set-current")
            ->assertOk()
            ->assertJsonPath('data.is_current', true);

        $this->assertFalse($current->fresh()->is_current);
        $this->assertSame(1, AcademicPeriod::query()->where('is_current', true)->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'period.set_current', 'auditable_id' => $next->id]);
    }

    public function test_period_in_use_cannot_be_deleted(): void
    {
        $context = $this->academicContext();

        $this->actingAs($this->admin(), 'sanctum')
            ->deleteJson('/api/admin/periods/'.$context['period']->id)
            ->assertStatus(422);

        $this->assertModelExists(Classroom::query()->find($context['classroom']->id));
    }
}
