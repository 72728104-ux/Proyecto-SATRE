<?php

namespace Tests\Feature\Coverage;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Services\SocraticTutorService;
use App\Services\TeacherAssistantService;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Mockery;
use RuntimeException;
use Tests\TestCase;

/**
 * Cubre los catch de AnalyticsController y la pertenencia al aula vía matrícula.
 */
class AnalyticsControllerCoverageTest extends TestCase
{
    use RefreshDatabase;

    private const TEACHER_ASSISTANT_ENDPOINT = '/api/v1/analytics/teacher-assistant';

    private const SOCRATIC_ENDPOINT = '/api/ai-analytics/student/socratic-tutor';

    private AcademicPeriod $period;

    private User $teacherUser;

    private Teacher $teacher;

    private Classroom $classroom;

    private Course $course;

    private User $studentUser;

    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->period = AcademicPeriod::factory()->create(['is_current' => true]);
        $this->teacherUser = $this->userWithRole(Roles::TEACHER);
        $this->teacher = Teacher::factory()->create(['user_id' => $this->teacherUser->id]);
        $this->classroom = Classroom::factory()->create([
            'academic_period_id' => $this->period->id,
            'tutor_id' => $this->teacher->id,
        ]);
        $this->course = Course::factory()->create([
            'classroom_id' => $this->classroom->id,
            'teacher_id' => $this->teacher->id,
            'academic_period_id' => $this->period->id,
        ]);
        $this->studentUser = $this->userWithRole(Roles::STUDENT);
        $this->student = Student::factory()->create([
            'user_id' => $this->studentUser->id,
            'classroom_id' => $this->classroom->id,
        ]);
        Enrollment::factory()->create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
        ]);
    }

    public function test_teacher_assistant_maps_validation_and_internal_errors(): void
    {
        $service = Mockery::mock(TeacherAssistantService::class);
        $service->shouldReceive('ask')->once()->andThrow(ValidationException::withMessages([
            'message' => 'Consulta inválida.',
        ]));
        $this->app->instance(TeacherAssistantService::class, $service);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::TEACHER_ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => 'Consulta',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['message']);

        $service = Mockery::mock(TeacherAssistantService::class);
        $service->shouldReceive('ask')->once()->andThrow(new RuntimeException('boom'));
        $this->app->instance(TeacherAssistantService::class, $service);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::TEACHER_ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'message' => 'Consulta',
            ])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null)
            ->assertJsonPath('reason', 'internal_error')
            ->assertJsonPath('message', 'El asistente docente no está disponible en este momento.');
    }

    public function test_socratic_turn_maps_validation_and_internal_errors(): void
    {
        $tutor = Mockery::mock(SocraticTutorService::class);
        $tutor->shouldReceive('turn')->once()->andThrow(ValidationException::withMessages([
            'session_id' => 'Sesión inválida.',
        ]));
        $this->app->instance(SocraticTutorService::class, $tutor);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::SOCRATIC_ENDPOINT, [
                'course_id' => $this->course->id,
                'topic' => 'Funciones lineales',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session_id']);

        $tutor = Mockery::mock(SocraticTutorService::class);
        $tutor->shouldReceive('turn')->once()->andThrow(new RuntimeException('boom'));
        $this->app->instance(SocraticTutorService::class, $tutor);

        $this->actingAs($this->studentUser, 'sanctum')
            ->postJson(self::SOCRATIC_ENDPOINT, [
                'course_id' => $this->course->id,
                'topic' => 'Funciones lineales',
            ])
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('data', null)
            ->assertJsonPath('reason', 'internal_error')
            ->assertJsonPath('message', 'El tutor no está disponible en este momento.');
    }

    public function test_student_belongs_to_classroom_through_active_enrollment(): void
    {
        $otherClassroom = Classroom::factory()->create(['academic_period_id' => $this->period->id]);
        $this->student->update(['classroom_id' => $otherClassroom->id]);

        $service = Mockery::mock(TeacherAssistantService::class);
        $service->shouldReceive('ask')->once()->andReturn([
            'available' => true,
            'data' => [
                'reply' => ['text' => 'ok'],
                'metrics' => [],
                'engine' => 'hybrid',
                'insufficient_data' => false,
            ],
        ]);
        $this->app->instance(TeacherAssistantService::class, $service);

        $this->actingAs($this->teacherUser, 'sanctum')
            ->postJson(self::TEACHER_ASSISTANT_ENDPOINT, [
                'classroom_id' => $this->classroom->id,
                'student_id' => $this->student->id,
                'message' => '¿Cómo está el estudiante?',
            ])
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('data.reply.text', 'ok');
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
