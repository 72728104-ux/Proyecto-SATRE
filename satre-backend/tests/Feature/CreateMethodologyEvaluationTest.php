<?php

namespace Tests\Feature;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\GuidedQuestion;
use App\Models\GuidedResponse;
use App\Models\QuizAttempt;
use App\Models\ReadingMaterial;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CreateMethodologyEvaluationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.python_analytics.url' => 'http://analytics.test',
            'services.python_analytics.key' => 'test-internal-key',
        ]);
        Http::fake();
    }

    public function test_student_lists_questions_without_correct_answer_or_aggregates(): void
    {
        $context = $this->evaluationContext();
        $question = $this->createQuestion($context['reading']);
        [$studentUser] = $this->attachStudentUser($context['student']);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/academic/readings/{$context['reading']->id}/questions")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $question->id)
            ->assertJsonPath('data.0.prompt', '¿Cuál es la hipótesis?')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonMissingPath('data.0.correct_answer')
            ->assertJsonMissingPath('data.0.aggregates');
    }

    public function test_student_receives_immediate_feedback_on_guided_question(): void
    {
        $context = $this->evaluationContext();
        $mc = $this->createQuestion($context['reading']);
        $short = GuidedQuestion::query()->create([
            'reading_material_id' => $context['reading']->id,
            'prompt' => 'Resume la hipótesis nula',
            'type' => GuidedQuestion::TYPE_SHORT,
            'options' => null,
            'correct_answer' => 'hipótesis nula',
        ]);
        [$studentUser] = $this->attachStudentUser($context['student']);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/questions", [
                'guided_question_id' => $mc->id,
                'response' => 'A',
            ])
            ->assertCreated()
            ->assertJsonPath('data.guided_question_id', $mc->id)
            ->assertJsonPath('data.student_id', $context['student']->id)
            ->assertJsonPath('data.is_correct', true)
            ->assertJsonPath('data.feedback', 'Correcto.')
            ->assertJsonMissingPath('data.student_name')
            ->assertJsonMissingPath('data.first_name');

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/questions", [
                'guided_question_id' => $mc->id,
                'response' => 'B',
            ])
            ->assertCreated()
            ->assertJsonPath('data.is_correct', false)
            ->assertJsonPath('data.feedback', 'Incorrecto. La respuesta esperada es: A.');

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/questions", [
                'guided_question_id' => $short->id,
                'response' => 'El artículo plantea la hipótesis nula del experimento',
            ])
            ->assertCreated()
            ->assertJsonPath('data.is_correct', true);

        $this->assertDatabaseCount('guided_responses', 3);
        Http::assertNothingSent();
    }

    public function test_teacher_and_admin_read_question_aggregates_but_cannot_answer(): void
    {
        $context = $this->evaluationContext();
        $question = $this->createQuestion($context['reading']);
        GuidedResponse::query()->create([
            'guided_question_id' => $question->id,
            'student_id' => $context['student']->id,
            'response' => 'A',
            'is_correct' => true,
        ]);
        $admin = $this->userWithRole(Roles::ADMIN);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson("/api/academic/readings/{$context['reading']->id}/questions")
            ->assertOk()
            ->assertJsonPath('data.0.correct_answer', 'A')
            ->assertJsonPath('data.0.aggregates.response_count', 1)
            ->assertJsonPath('data.0.aggregates.correct_count', 1)
            ->assertJsonMissingPath('data.0.student_name');

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/academic/readings/{$context['reading']->id}/questions")
            ->assertOk()
            ->assertJsonPath('data.0.aggregates.response_count', 1);

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/questions", [
                'guided_question_id' => $question->id,
                'response' => 'A',
            ])
            ->assertForbidden();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/questions", [
                'guided_question_id' => $question->id,
                'response' => 'A',
            ])
            ->assertForbidden();
    }

    public function test_student_cannot_answer_question_of_another_reading_or_without_enrollment(): void
    {
        $context = $this->evaluationContext();
        $this->createQuestion($context['reading']);
        [$studentUser] = $this->attachStudentUser($context['student']);

        $otherReading = ReadingMaterial::query()->create([
            'course_id' => $context['course']->id,
            'title' => 'Otra lectura',
            'criterion' => 'B',
            'content' => 'Otro texto',
            'created_by' => $context['teacherUser']->id,
        ]);
        $foreignQuestion = $this->createQuestion($otherReading, '¿Tema ajeno?');

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/questions", [
                'guided_question_id' => $foreignQuestion->id,
                'response' => 'A',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['guided_question_id']);

        $outsider = Student::factory()->create(['classroom_id' => $context['classroom']->id]);
        [$outsiderUser] = $this->attachStudentUser($outsider);

        $this->actingAs($outsiderUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/questions", [
                'guided_question_id' => GuidedQuestion::query()->where('reading_material_id', $context['reading']->id)->value('id'),
                'response' => 'A',
            ])
            ->assertForbidden();
    }

    public function test_student_quiz_calculates_score_and_keeps_attempt_history(): void
    {
        $context = $this->evaluationContext();
        $first = $this->createQuestion($context['reading']);
        $second = GuidedQuestion::query()->create([
            'reading_material_id' => $context['reading']->id,
            'prompt' => '¿Cuál es la variable dependiente?',
            'type' => GuidedQuestion::TYPE_MULTIPLE_CHOICE,
            'options' => ['A', 'B'],
            'correct_answer' => 'B',
        ]);
        [$studentUser] = $this->attachStudentUser($context['student']);
        $peer = Student::factory()->create(['classroom_id' => $context['classroom']->id]);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/quiz", [
                'answers' => [
                    ['guided_question_id' => $first->id, 'response' => 'A'],
                    ['guided_question_id' => $second->id, 'response' => 'A'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.student_id', $context['student']->id)
            ->assertJsonPath('data.score', 50)
            ->assertJsonPath('data.total_questions', 2)
            ->assertJsonPath('data.correct_count', 1)
            ->assertJsonPath('data.results.0.is_correct', true)
            ->assertJsonPath('data.results.1.is_correct', false)
            ->assertJsonMissingPath('data.student_name')
            ->assertJsonMissingPath('data.first_name');

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/quiz", [
                'answers' => [
                    ['guided_question_id' => $first->id, 'response' => 'A'],
                    ['guided_question_id' => $second->id, 'response' => 'B'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.score', 100)
            ->assertJsonPath('data.correct_count', 2);

        QuizAttempt::query()->create([
            'reading_material_id' => $context['reading']->id,
            'student_id' => $peer->id,
            'score' => 0,
            'total_questions' => 2,
            'correct_count' => 0,
            'completed_at' => now(),
        ]);

        $this->actingAs($studentUser, 'sanctum')
            ->getJson("/api/academic/readings/{$context['reading']->id}/quiz")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('data.0.student_id', $context['student']->id)
            ->assertJsonMissingPath('data.0.student_name');

        $this->actingAs($context['teacherUser'], 'sanctum')
            ->getJson("/api/academic/readings/{$context['reading']->id}/quiz")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.student_name', $peer->first_name.' '.$peer->last_name);

        $this->assertDatabaseCount('quiz_attempts', 3);
        Http::assertNothingSent();
    }

    public function test_quiz_rejects_answers_from_another_reading_and_empty_bank(): void
    {
        $context = $this->evaluationContext();
        $question = $this->createQuestion($context['reading']);
        [$studentUser] = $this->attachStudentUser($context['student']);

        $otherReading = ReadingMaterial::query()->create([
            'course_id' => $context['course']->id,
            'title' => 'Sin banco',
            'created_by' => $context['teacherUser']->id,
        ]);
        $foreign = $this->createQuestion($otherReading);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/quiz", [
                'answers' => [
                    ['guided_question_id' => $question->id, 'response' => 'A'],
                    ['guided_question_id' => $foreign->id, 'response' => 'A'],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['answers']);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$otherReading->id}/quiz", [
                'answers' => [
                    ['guided_question_id' => $foreign->id, 'response' => 'A'],
                ],
            ])
            ->assertCreated();

        $empty = ReadingMaterial::query()->create([
            'course_id' => $context['course']->id,
            'title' => 'Vacía',
            'created_by' => $context['teacherUser']->id,
        ]);

        $this->actingAs($studentUser, 'sanctum')
            ->postJson("/api/academic/readings/{$empty->id}/quiz", [
                'answers' => [
                    ['guided_question_id' => $question->id, 'response' => 'A'],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['answers']);
    }

    public function test_monitor_and_guardian_cannot_access_evaluation_routes(): void
    {
        $context = $this->evaluationContext();
        $question = $this->createQuestion($context['reading']);

        $this->actingAs($this->userWithRole(Roles::MONITOR), 'sanctum')
            ->getJson("/api/academic/readings/{$context['reading']->id}/questions")
            ->assertForbidden();

        $this->actingAs($this->userWithRole(Roles::GUARDIAN), 'sanctum')
            ->postJson("/api/academic/readings/{$context['reading']->id}/quiz", [
                'answers' => [['guided_question_id' => $question->id, 'response' => 'A']],
            ])
            ->assertForbidden();
    }

    /**
     * @return array{teacherUser: User, student: Student, course: Course, classroom: Classroom, reading: ReadingMaterial}
     */
    private function evaluationContext(): array
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
        $reading = ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Artículo CREATE',
            'criterion' => 'A',
            'content' => 'Texto del artículo',
            'created_by' => $teacherUser->id,
        ]);

        return compact('teacherUser', 'student', 'course', 'classroom', 'reading');
    }

    private function createQuestion(ReadingMaterial $reading, string $prompt = '¿Cuál es la hipótesis?'): GuidedQuestion
    {
        return GuidedQuestion::query()->create([
            'reading_material_id' => $reading->id,
            'prompt' => $prompt,
            'type' => GuidedQuestion::TYPE_MULTIPLE_CHOICE,
            'options' => ['A', 'B'],
            'correct_answer' => 'A',
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
