<?php

namespace App\Http\Controllers;

use App\Http\Requests\SocraticTutorTurnRequest;
use App\Http\Requests\TeacherAssistantRequest;
use App\Http\Resources\RiskPredictionResource;
use App\Http\Resources\TutorSessionResource;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Student;
use App\Models\TutorSession;
use App\Services\AnalyticsService;
use App\Services\SocraticTutorService;
use App\Services\TeacherAssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class AnalyticsController extends Controller
{
    public function teacherInsights(Classroom $classroom, AnalyticsService $analytics): JsonResponse
    {
        $this->authorize('viewInsights', $classroom);

        return response()->json($analytics->classroomInsights($classroom));
    }

    public function teacherAssistant(TeacherAssistantRequest $request, TeacherAssistantService $assistant): JsonResponse
    {
        $classroom = Classroom::query()->findOrFail($request->validated('classroom_id'));
        $this->authorize('viewInsights', $classroom);

        $student = null;
        if ($request->filled('student_id')) {
            $student = Student::query()->findOrFail($request->validated('student_id'));
            $this->authorize('viewRisk', $student);
            abort_unless($this->studentBelongsToClassroom($student, $classroom), 403);
        }

        try {
            $result = $assistant->ask($classroom, $student, $request->validated());
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::warning('teacher assistant failed', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'available' => false,
                'data' => null,
                'reason' => 'internal_error',
                'message' => 'El asistente docente no está disponible en este momento.',
            ]);
        }

        if (($result['status'] ?? null) === 503) {
            return response()->json($result, 503);
        }

        return response()->json($result);
    }

    public function studentRisk(Request $request, Student $student, AnalyticsService $analytics): JsonResponse
    {
        $this->authorize('viewRisk', $student);

        $canRefresh = $request->user()->can('viewRiskDetail', $student);

        $prediction = $analytics->predictionFor(
            $student,
            $canRefresh,
            $canRefresh && $request->boolean('refresh'),
        );

        return response()->json([
            'available' => $prediction !== null,
            'data' => $prediction ? new RiskPredictionResource($prediction->setRelation('student', $student)) : null,
        ]);
    }

    public function socraticSessions(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', TutorSession::class);

        $sessions = TutorSession::query()
            ->where('student_id', $request->user()->student?->id ?? 0)
            ->with(['course:id,name', 'messages'])
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->latest('updated_at')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return TutorSessionResource::collection($sessions);
    }

    public function socraticTurn(SocraticTutorTurnRequest $request, SocraticTutorService $tutor): JsonResponse
    {
        $student = $request->user()->student;
        abort_if($student === null, 404, 'Perfil de estudiante no encontrado.');

        $session = null;
        if ($request->filled('session_id')) {
            $session = TutorSession::query()->with('course')->findOrFail($request->validated('session_id'));
            $this->authorize('update', $session);
            $course = $session->course;
        } else {
            $course = Course::query()->findOrFail($request->validated('course_id'));
            $this->authorize('create', [TutorSession::class, $course]);
        }

        try {
            $result = $tutor->turn($student, $course, $session, $request->validated());
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::warning('socratic tutor turn failed', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'available' => false,
                'data' => null,
                'reason' => 'internal_error',
                'message' => 'El tutor no está disponible en este momento.',
            ]);
        }

        if (! $result['available']) {
            $status = ($result['status'] ?? null) === 503 ? 503 : 200;

            return response()->json($result, $status);
        }

        return response()->json([
            'available' => true,
            'data' => [
                'session' => new TutorSessionResource($result['data']['session']),
                'reply' => $result['data']['reply'],
                'done' => $result['data']['done'],
            ],
        ]);
    }

    private function studentBelongsToClassroom(Student $student, Classroom $classroom): bool
    {
        if ((int) $student->classroom_id === (int) $classroom->id) {
            return true;
        }

        return $student->enrollments()
            ->where('status', 'active')
            ->whereHas('course', fn ($query) => $query->where('classroom_id', $classroom->id))
            ->exists();
    }
}
