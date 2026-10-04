<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\GuidedQuestion;
use App\Models\GuidedResponse;
use App\Models\QuizAttempt;
use App\Models\ReadingMaterial;
use App\Models\Student;
use App\Models\StudentArtifact;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CreateSatreMethodologySchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_satre_tables_exist_with_soft_deletes_only_where_specified(): void
    {
        foreach (['reading_materials', 'student_artifacts', 'guided_questions', 'guided_responses', 'quiz_attempts'] as $table) {
            $this->assertTrue(Schema::hasTable($table), $table);
        }

        $this->assertTrue(Schema::hasColumn('reading_materials', 'deleted_at'));
        $this->assertTrue(Schema::hasColumn('student_artifacts', 'deleted_at'));
        $this->assertFalse(Schema::hasColumn('guided_questions', 'deleted_at'));
        $this->assertFalse(Schema::hasColumn('guided_responses', 'deleted_at'));
        $this->assertFalse(Schema::hasColumn('quiz_attempts', 'deleted_at'));
        $this->assertFalse(Schema::hasColumn('tutor_sessions', 'reading_material_id'));
    }

    public function test_models_persist_relations_and_soft_delete_reading_materials(): void
    {
        $teacher = User::factory()->teacher()->create();
        $course = Course::factory()->create();
        $student = Student::factory()->create();

        $reading = ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Artículo CREATE',
            'criterion' => 'A',
            'content' => 'Texto del artículo',
            'url' => 'https://example.edu/articulo',
            'created_by' => $teacher->id,
        ]);

        $artifact = StudentArtifact::query()->create([
            'reading_material_id' => $reading->id,
            'student_id' => $student->id,
            'nodes' => [['id' => 'n1', 'label' => 'Hipótesis']],
            'connections' => [['from' => 'n1', 'to' => 'n1']],
        ]);

        $question = GuidedQuestion::query()->create([
            'reading_material_id' => $reading->id,
            'prompt' => '¿Cuál es la hipótesis?',
            'type' => GuidedQuestion::TYPE_MULTIPLE_CHOICE,
            'options' => ['A', 'B'],
            'correct_answer' => 'A',
        ]);

        GuidedResponse::query()->create([
            'guided_question_id' => $question->id,
            'student_id' => $student->id,
            'response' => 'A',
            'is_correct' => true,
        ]);

        QuizAttempt::query()->create([
            'reading_material_id' => $reading->id,
            'student_id' => $student->id,
            'score' => 100,
            'total_questions' => 1,
            'correct_count' => 1,
            'completed_at' => now(),
        ]);

        $this->assertTrue($course->readingMaterials()->whereKey($reading->id)->exists());
        $this->assertTrue($student->artifacts()->whereKey($artifact->id)->exists());
        $this->assertSame(['A', 'B'], $question->fresh()->options);
        $this->assertTrue($reading->quizAttempts()->exists());

        $reading->delete();
        $artifact->delete();

        $this->assertSoftDeleted('reading_materials', ['id' => $reading->id]);
        $this->assertSoftDeleted('student_artifacts', ['id' => $artifact->id]);
        $this->assertDatabaseHas('guided_questions', ['id' => $question->id]);
    }
}
