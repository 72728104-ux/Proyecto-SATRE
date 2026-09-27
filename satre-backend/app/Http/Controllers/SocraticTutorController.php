<?php

namespace App\Http\Controllers;

use App\Http\Requests\SocraticTutorTurnRequest;
use App\Http\Resources\TutorSessionResource;
use App\Models\Course;
use App\Models\TutorSession;
use App\Services\SocraticTutorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SocraticTutorController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
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

    public function store(SocraticTutorTurnRequest $request, SocraticTutorService $tutor): JsonResponse
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
