<?php

namespace Tests\Feature\Coverage;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ReadingMaterial;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Services\GuidedQuestionService;
use App\Services\QuizAttemptService;
use App\Services\StudentArtifactService;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Cubre las validaciones de servicios que no se alcanzan desde HTTP porque
 * las políticas ya bloquean a usuarios sin matrícula o sin perfil.
 */
class StudentServicesCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_quiz_service_rejects_user_without_student_profile(): void
    {
        $user = $this->userWithRole(Roles::STUDENT);
        $reading = $this->reading();

        $this->assertValidationError(
            fn () => app(QuizAttemptService::class)->submit($user, $reading, ['answers' => []]),
            'answers',
            'El usuario no tiene perfil de estudiante.',
        );
    }

    public function test_quiz_service_rejects_student_not_enrolled_in_reading_course(): void
    {
        $student = Student::factory()->create();
        $user = $this->userWithRole(Roles::STUDENT);
        $student->update(['user_id' => $user->id]);
        $reading = $this->reading();

        $this->assertValidationError(
            fn () => app(QuizAttemptService::class)->submit($user, $reading, ['answers' => []]),
            'answers',
            'El estudiante no está matriculado en el curso de esta lectura.',
        );
    }

    public function test_guided_question_service_rejects_missing_profile_and_enrollment(): void
    {
        $user = $this->userWithRole(Roles::STUDENT);
        $reading = $this->reading();

        $this->assertValidationError(
            fn () => app(GuidedQuestionService::class)->answer($user, $reading, ['guided_question_id' => 1, 'response' => 'A']),
            'response',
            'El usuario no tiene perfil de estudiante.',
        );

        $student = Student::factory()->create();
        $student->update(['user_id' => $user->id]);

        $this->assertValidationError(
            fn () => app(GuidedQuestionService::class)->answer($user->fresh(), $reading, ['guided_question_id' => 1, 'response' => 'A']),
            'response',
            'El estudiante no está matriculado en el curso de esta lectura.',
        );
    }

    public function test_student_artifact_service_rejects_missing_profile_and_enrollment(): void
    {
        $user = $this->userWithRole(Roles::STUDENT);
        $reading = $this->reading();

        $this->assertValidationError(
            fn () => app(StudentArtifactService::class)->submit($user, $reading, ['nodes' => [], 'connections' => []]),
            'nodes',
            'El usuario no tiene perfil de estudiante.',
        );

        $student = Student::factory()->create();
        $student->update(['user_id' => $user->id]);

        $this->assertValidationError(
            fn () => app(StudentArtifactService::class)->submit($user->fresh(), $reading, ['nodes' => [], 'connections' => []]),
            'nodes',
            'El estudiante no está matriculado en el curso de esta lectura.',
        );
    }

    /**
     * @param  callable(): mixed  $callback
     */
    private function assertValidationError(callable $callback, string $field, string $message): void
    {
        try {
            $callback();
            $this->fail('Se esperaba una ValidationException.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey($field, $exception->errors());
            $this->assertSame($message, $exception->errors()[$field][0]);
        }
    }

    private function reading(): ReadingMaterial
    {
        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);
        $course = Course::factory()->create([
            'classroom_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'academic_period_id' => $period->id,
        ]);

        return ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Lectura',
            'created_by' => $teacherUser->id,
        ]);
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
