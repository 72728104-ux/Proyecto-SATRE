<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAttendanceRequest;
use App\Http\Requests\StoreAttendanceSessionRequest;
use App\Http\Resources\AttendanceResource;
use App\Models\Attendance;
use App\Models\Course;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AttendanceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Attendance::class);

        $attendances = Attendance::query()
            ->visibleTo($request->user())
            ->with('course:id,name')
            ->when($request->integer('course_id'), fn ($query, $courseId) => $query->where('course_id', $courseId))
            ->when($request->date('attendance_date'), fn ($query, $date) => $query->whereDate('attendance_date', $date))
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('attendance_date')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return AttendanceResource::collection($attendances);
    }

    public function store(StoreAttendanceRequest $request, AttendanceService $attendanceService): JsonResponse
    {
        $course = Course::query()->findOrFail($request->validated('course_id'));
        $this->authorize('create', [Attendance::class, $course]);

        $attendance = $attendanceService->record($request->user(), $request->validated());

        return (new AttendanceResource($attendance))
            ->response()
            ->setStatusCode(201);
    }

    public function storeSession(StoreAttendanceSessionRequest $request, AttendanceService $attendanceService): JsonResponse
    {
        $course = Course::query()->findOrFail($request->validated('course_id'));
        $this->authorize('create', [Attendance::class, $course]);

        $attendances = $attendanceService->saveSession($request->user(), $request->validated());

        return response()->json([
            'message' => 'Asistencia registrada.',
            'data' => AttendanceResource::collection($attendances),
        ]);
    }
}
