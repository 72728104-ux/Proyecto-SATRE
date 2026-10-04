<?php

namespace App\Http\Controllers;

use App\Http\Requests\SocraticTutorTurnRequest;
use App\Http\Resources\RiskPredictionResource;
use App\Http\Resources\TutorSessionResource;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Student;
use App\Models\TutorSession;
use App\Services\AnalyticsService;
use App\Services\SocraticTutorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AnalyticsController extends Controller
{
    public function teacherInsights(Classroom $classroom, AnalyticsService $analytics): JsonResponse
    {
        $this->authorize('viewInsights', $classroom);

        return response()->json($analytics->classroomInsights($classroom));
    }

    public function studentRisk(Request $request, Student $student, AnalyticsService $analytics): JsonResponse
    {
        $this->authorize('viewRisk', $student);

        $prediction = $analytics->predictionFor(
            $student,
            $request->user()->can('viewRiskDetail', $student),
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

        $result = $tutor->turn($student, $course, $session, $request->validated());

        if (! $result['available']) {
            return response()->json($result);
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
}
