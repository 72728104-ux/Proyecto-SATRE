<?php

namespace Tests\Feature\Coverage;

use App\Models\AcademicPeriod;
use App\Models\AiDiagnostic;
use App\Models\Alert;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Document;
use App\Models\Enrollment;
use App\Models\FollowUp;
use App\Models\Grade;
use App\Models\GuidedQuestion;
use App\Models\GuidedResponse;
use App\Models\Incident;
use App\Models\Intervention;
use App\Models\Monitor;
use App\Models\PermissionRequest;
use App\Models\QuizAttempt;
use App\Models\ReadingMaterial;
use App\Models\ResidentialPresence;
use App\Models\RiskExplanation;
use App\Models\RiskPrediction;
use App\Models\Role;
use App\Models\Student;
use App\Models\StudentArtifact;
use App\Models\StudentFeatureSnapshot;
use App\Models\TutorMessage;
use App\Models\TutorSession;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ejercita relaciones y casts de modelos con líneas sin cubrir en coverage.xml.
 */
class ModelRelationsCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_model_relations_and_casts_are_reachable(): void
    {
        $role = Role::factory()->create(['slug' => Roles::ADMIN, 'name' => 'Admin', 'description' => 'Admin']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $this->assertTrue($role->users()->whereKey($user->id)->exists());

        $period = AcademicPeriod::factory()->create(['is_current' => true]);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = \App\Models\Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $classroom = Classroom::factory()->create([
            'academic_period_id' => $period->id,
            'tutor_id' => $teacher->id,
        ]);
        $course = Course::factory()->create([
            'classroom_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'academic_period_id' => $period->id,
        ]);
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student = Student::factory()->create([
            'user_id' => $studentUser->id,
            'classroom_id' => $classroom->id,
            'is_boarder' => true,
        ]);
        $guardian = \App\Models\Guardian::factory()->create();
        $student->guardians()->attach($guardian->id, ['relationship' => 'madre', 'is_primary' => true]);
        $enrollment = Enrollment::factory()->create(['student_id' => $student->id, 'course_id' => $course->id]);

        $attendance = Attendance::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'academic_period_id' => $period->id,
            'recorded_by' => $teacherUser->id,
        ]);
        $presence = ResidentialPresence::query()->create([
            'student_id' => $student->id,
            'presence_date' => '2026-04-01',
            'check_type' => 'night',
            'status' => 'present',
            'recorded_by' => $teacherUser->id,
        ]);
        $grade = Grade::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'academic_period_id' => $period->id,
            'recorded_by' => $teacherUser->id,
        ]);
        $incident = Incident::factory()->create(['student_id' => $student->id]);
        $permission = PermissionRequest::factory()->create([
            'student_id' => $student->id,
            'guardian_id' => $guardian->id,
            'requested_by' => $studentUser->id,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        $snapshot = StudentFeatureSnapshot::query()->create([
            'student_id' => $student->id,
            'academic_period_id' => $period->id,
            'snapshot_at' => now(),
            'attendance_rate' => 0.95,
            'extra_features' => ['foo' => 'bar'],
        ]);
        $prediction = RiskPrediction::factory()->create([
            'student_id' => $student->id,
            'academic_period_id' => $period->id,
            'student_feature_snapshot_id' => $snapshot->id,
        ]);
        $explanation = RiskExplanation::query()->create([
            'risk_prediction_id' => $prediction->id,
            'method' => 'shap',
            'explanation_payload' => ['summary' => 'Riesgo por ausencias'],
            'generated_at' => now(),
        ]);
        $diagnostic = AiDiagnostic::factory()->create([
            'student_id' => $student->id,
            'classroom_id' => $classroom->id,
            'academic_period_id' => $period->id,
        ]);
        $tutorSession = TutorSession::query()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'topic' => 'Funciones',
            'status' => TutorSession::STATUS_ACTIVE,
        ]);
        TutorMessage::query()->create([
            'tutor_session_id' => $tutorSession->id,
            'role' => TutorMessage::ROLE_TUTOR,
            'content' => '¿Qué recuerdas?',
        ]);
        $reading = ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Lectura',
            'created_by' => $teacherUser->id,
        ]);
        $question = GuidedQuestion::query()->create([
            'reading_material_id' => $reading->id,
            'prompt' => '¿Pregunta?',
            'type' => GuidedQuestion::TYPE_SHORT,
            'correct_answer' => 'respuesta',
        ]);
        $guided = GuidedResponse::query()->create([
            'guided_question_id' => $question->id,
            'student_id' => $student->id,
            'response' => 'respuesta',
            'is_correct' => true,
        ]);
        $artifact = StudentArtifact::query()->create([
            'reading_material_id' => $reading->id,
            'student_id' => $student->id,
            'nodes' => [['id' => 'n1']],
            'connections' => [],
        ]);
        $attempt = QuizAttempt::query()->create([
            'reading_material_id' => $reading->id,
            'student_id' => $student->id,
            'score' => 100,
            'total_questions' => 1,
            'correct_count' => 1,
            'completed_at' => now(),
        ]);
        $monitor = Monitor::factory()->create();
        $document = Document::query()->create([
            'student_id' => $student->id,
            'documentable_type' => Student::class,
            'documentable_id' => $student->id,
            'original_name' => 'acta.pdf',
            'path' => 'docs/acta.pdf',
            'uploaded_by' => $teacherUser->id,
        ]);

        $alert = Alert::query()->create([
            'student_id' => $student->id,
            'risk_prediction_id' => $prediction->id,
            'type' => 'risk',
            'severity' => 'ALTO',
            'title' => 'Riesgo',
            'message' => 'Riesgo alto',
        ]);
        $intervention = Intervention::query()->create([
            'alert_id' => $alert->id,
            'student_id' => $student->id,
            'type' => 'tutoria',
            'description' => 'Acompañamiento',
        ]);
        $followUp = FollowUp::query()->create([
            'intervention_id' => $intervention->id,
            'student_id' => $student->id,
            'recorded_by' => $teacherUser->id,
            'follow_up_date' => '2026-04-02',
            'outcome' => 'mejora',
            'notes' => 'Mejoró',
        ]);

        // AcademicPeriod
        $this->assertTrue($period->classrooms()->whereKey($classroom->id)->exists());
        $this->assertTrue($period->courses()->whereKey($course->id)->exists());
        $this->assertTrue($period->grades()->whereKey($grade->id)->exists());
        $this->assertTrue($period->attendances()->whereKey($attendance->id)->exists());
        $this->assertTrue($period->riskPredictions()->whereKey($prediction->id)->exists());
        $this->assertTrue($period->aiDiagnostics()->whereKey($diagnostic->id)->exists());

        // Student
        $this->assertTrue($student->user->is($studentUser));
        $this->assertTrue($student->classroom->is($classroom));
        $this->assertTrue($student->guardians->contains($guardian));
        $this->assertTrue($student->enrollments->contains($enrollment));
        $this->assertTrue($student->attendances->contains($attendance));
        $this->assertTrue($student->residentialPresences->contains($presence));
        $this->assertTrue($student->grades->contains($grade));
        $this->assertTrue($student->featureSnapshots->contains($snapshot));
        $this->assertTrue($student->incidents->contains($incident));
        $this->assertTrue($student->permissionRequests->contains($permission));
        $this->assertTrue($student->riskPredictions->contains($prediction));
        $this->assertTrue($student->aiDiagnostics->contains($diagnostic));
        $this->assertTrue($student->tutorSessions->contains($tutorSession));
        $this->assertTrue($student->artifacts->contains($artifact));
        $this->assertTrue($student->guidedResponses->contains($guided));
        $this->assertTrue($student->quizAttempts->contains($attempt));
        $this->assertTrue($student->is_boarder);

        // Course
        $this->assertTrue($course->attendances->contains($attendance));
        $this->assertTrue($course->grades->contains($grade));
        $this->assertTrue($course->tutorSessions->contains($tutorSession));

        // Risk model graph
        $this->assertTrue($prediction->academicPeriod->is($period));
        $this->assertTrue($prediction->snapshot->is($snapshot));
        $this->assertTrue($prediction->explanation->is($explanation));
        $this->assertTrue($snapshot->student->is($student));
        $this->assertTrue($snapshot->academicPeriod->is($period));
        $this->assertTrue($snapshot->riskPredictions->contains($prediction));
        $this->assertTrue($explanation->prediction->is($prediction));
        $this->assertSame(['summary' => 'Riesgo por ausencias'], $explanation->explanation_payload);
        $this->assertNotNull($explanation->generated_at);

        // AI diagnostics
        $this->assertTrue($diagnostic->student->is($student));
        $this->assertTrue($diagnostic->classroom->is($classroom));
        $this->assertTrue($diagnostic->academicPeriod->is($period));

        // Guided response / document / monitor / permission
        $this->assertTrue($guided->guidedQuestion->is($question));
        $this->assertTrue($guided->student->is($student));
        $this->assertTrue($guided->is_correct);
        $this->assertTrue($document->documentable->is($student));
        $this->assertTrue($document->student->is($student));
        $this->assertTrue($monitor->user->is($monitor->user));
        $this->assertTrue($permission->guardian->is($guardian));
        $this->assertTrue($permission->requester->is($studentUser));
        $this->assertTrue($permission->reviewer->is($user));

        // Follow ups
        $this->assertTrue($followUp->intervention->is($intervention));
        $this->assertTrue($followUp->student->is($student));
        $this->assertTrue($followUp->recorder->is($teacherUser));

        // Reading relations used by artifacts/quizzes
        $this->assertTrue($reading->artifacts->contains($artifact));
        $this->assertTrue($reading->guidedQuestions->contains($question));
        $this->assertTrue($reading->quizAttempts->contains($attempt));
        $this->assertTrue($question->responses->contains($guided));
        $this->assertTrue($artifact->readingMaterial->is($reading));
        $this->assertTrue($attempt->readingMaterial->is($reading));
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
