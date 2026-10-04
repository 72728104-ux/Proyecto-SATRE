<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\ReadingMaterial;
use App\Models\Role;
use App\Models\Student;
use App\Models\StudentArtifact;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateMethodologyTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_creates_and_updates_reading_for_own_course(): void
    {
        $context = $this->methodologyContext();
        $payload = $this->readingPayload($context);

        $readingId = $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson('/api/academic/readings', $payload)
            ->assertCreated()
            ->assertJsonPath('data.title', 'Artículo CREATE')
            ->assertJsonPath('data.criterion', 'A')
            ->assertJsonPath('data.course_id', $context['course']->id)
            ->json('data.id');

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->putJson("/api/academic/readings/$readingId", [
                'title' => 'Artículo CREATE actualizado',
                'criterion' => 'B',
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Artículo CREATE actualizado')
            ->assertJsonPath('data.criterion', 'B');
    }

    public function test_teacher_cannot_manage_readings_of_other_teachers_course(): void
    {
        $context = $this->methodologyContext();
        $otherTeacherUser = $this->userWithRole(Roles::TEACHER);
        Teacher::factory()->create(['user_id' => $otherTeacherUser->id]);

        $this->actingAs($otherTeacherUser, 'sanctum')
            ->postJson('/api/academic/readings', $this->readingPayload($context))
            ->assertForbidden();

        $reading = $this->createReading($context);

        $this->actingAs($otherTeacherUser, 'sanctum')
            ->putJson("/api/academic/readings/{$reading->id}", ['title' => 'Intruso'])
            ->assertForbidden();

        $this->actingAs($otherTeacherUser, 'sanctum')
            ->getJson('/api/academic/readings')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_admin_reads_all_readings_but_cannot_write(): void
    {
        $context = $this->methodologyContext();
        $this->createReading($context);
        $admin = $this->userWithRole(Roles::ADMIN);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/academic/readings')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.per_page', 15);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/academic/readings', $this->readingPayload($context))
            ->assertForbidden();
    }

    public function test_student_lists_readings_of_enrolled_courses_filtered_by_course_id(): void
    {
        $context = $this->methodologyContext();
        $reading = $this->createReading($context);
        [$studentUser] = $this->attachStudentUser($context['student']);

        $otherCourse = Course::factory()->create([
            'classroom_id' => $context['classroom']->id,
            'teacher_id' => $context['course']->teacher_id,
            'academic_period_id' => $context['period']->id,
        ]);
        ReadingMaterial::query()->create([
            'course_id' => $otherCourse->id,
            'title' => 'Lectura de otro curso',
            'created_by' => $context['teacherUser']->id,
        ]);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson('/api/academic/readings?course_id='.$context['course']->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $reading->id)
            ->assertJsonPath('data.0.content', 'Texto del artículo');
    }

    public function test_student_submits_conceptual_map_without_automatic_grade(): void
    {
        $context = $this->methodologyContext();
        $reading = $this->createReading($context);
        [$studentUser] = $this->attachStudentUser($context['student']);
        $map = $this->artifactPayload();

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$reading->id}/artifacts", $map)
            ->assertCreated()
            ->assertJsonPath('data.student_id', $context['student']->id)
            ->assertJsonPath('data.reading_material_id', $reading->id)
            ->assertJsonPath('data.nodes.0.label', 'Hipótesis')
            ->assertJsonMissingPath('data.score')
            ->assertJsonMissingPath('data.grade');

        $this->assertSame(0, Grade::query()->count());
        $this->assertDatabaseHas('student_artifacts', [
            'reading_material_id' => $reading->id,
            'student_id' => $context['student']->id,
        ]);
    }

    public function test_empty_nodes_or_connections_are_rejected(): void
    {
        $context = $this->methodologyContext();
        $reading = $this->createReading($context);
        [$studentUser] = $this->attachStudentUser($context['student']);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$reading->id}/artifacts", [
                'nodes' => [],
                'connections' => [['from' => 'n1', 'to' => 'n1']],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nodes']);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$reading->id}/artifacts", [
                'nodes' => [['id' => 'n1', 'label' => 'Hipótesis']],
                'connections' => [],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['connections']);
    }

    public function test_student_cannot_submit_artifact_if_not_enrolled_in_the_course(): void
    {
        $context = $this->methodologyContext();
        $outsider = Student::factory()->create(['classroom_id' => $context['classroom']->id]);
        [$outsiderUser] = $this->attachStudentUser($outsider);
        $reading = $this->createReading($context);

        $this->actingAs($outsiderUser, 'sanctum')
            ->postJson("/api/academic/readings/{$reading->id}/artifacts", $this->artifactPayload())
            ->assertForbidden();
    }

    public function test_teacher_lists_artifacts_for_qualitative_review_student_only_sees_own(): void
    {
        $context = $this->methodologyContext();
        $reading = $this->createReading($context);
        [$studentUser] = $this->attachStudentUser($context['student']);
        $peer = Student::factory()->create(['classroom_id' => $context['classroom']->id]);

        StudentArtifact::query()->create([
            'reading_material_id' => $reading->id,
            'student_id' => $context['student']->id,
            'nodes' => [['id' => 'n1', 'label' => 'Propio']],
            'connections' => [['from' => 'n1', 'to' => 'n1']],
        ]);
        StudentArtifact::query()->create([
            'reading_material_id' => $reading->id,
            'student_id' => $peer->id,
            'nodes' => [['id' => 'n2', 'label' => 'Par']],
            'connections' => [['from' => 'n2', 'to' => 'n2']],
        ]);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson("/api/academic/readings/{$reading->id}/artifacts")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 15);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/academic/readings/{$reading->id}/artifacts")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_id', $context['student']->id);
    }

    public function test_monitor_and_guardian_cannot_access_readings(): void
    {
        $context = $this->methodologyContext();
        $this->createReading($context);

        $this->actingAs($this->userWithRole(Roles::MONITOR), 'sanctum')
            ->getJson('/api/academic/readings')
            ->assertForbidden();

        $this->actingAs($this->userWithRole(Roles::GUARDIAN), 'sanctum')
            ->postJson('/api/academic/readings', $this->readingPayload($context))
            ->assertForbidden();
    }

    /**
     * @return array{teacherUser: User, student: Student, course: Course, classroom: Classroom, period: AcademicPeriod}
     */
    private function methodologyContext(): array
    {
        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);
        $student = Student::factory()->create(['classroom_id' => $classroom->id]);
        $course = Course::factory()->create([
            'classroom_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'academic_period_id' => $period->id,
        ]);
        Enrollment::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
        ]);

        return compact('teacherUser', 'student', 'course', 'classroom', 'period');
    }

    /**
     * @param  array{teacherUser: User, course: Course}  $context
     */
    private function readingPayload(array $context): array
    {
        return [
            'course_id' => $context['course']->id,
            'title' => 'Artículo CREATE',
            'criterion' => 'A',
            'content' => 'Texto del artículo',
            'url' => 'https://example.edu/articulo',
        ];
    }

    /**
     * @return array{nodes: list<array<string, string>>, connections: list<array<string, string>>}
     */
    private function artifactPayload(): array
    {
        return [
            'nodes' => [['id' => 'n1', 'label' => 'Hipótesis']],
            'connections' => [['from' => 'n1', 'to' => 'n1']],
        ];
    }

    /**
     * @param  array{teacherUser: User, course: Course}  $context
     */
    private function createReading(array $context): ReadingMaterial
    {
        return ReadingMaterial::query()->create([
            'course_id' => $context['course']->id,
            'title' => 'Artículo CREATE',
            'criterion' => 'A',
            'content' => 'Texto del artículo',
            'url' => 'https://example.edu/articulo',
            'created_by' => $context['teacherUser']->id,
        ]);
    }

    /**
     * @return array{0: User}
     */
    private function attachStudentUser(Student $student): array
    {
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student->update(['user_id' => $studentUser->id]);

        return [$studentUser];
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(
            ['slug' => $slug],
            ['name' => $slug, 'description' => $slug]
        );

        return User::factory()->create([
            'role_id' => $role->id,
            'is_active' => true,
        ]);
    }
}
