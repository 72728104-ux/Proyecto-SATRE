<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShowAttendanceSessionRequest;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Services\AttendanceService;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Course::class);

        $user = $request->user()->loadMissing('teacher');

        $courses = Course::query()
            ->with('classroom')
            ->when(
                $user->hasRole(Roles::TEACHER),
                fn ($query) => $query->where('teacher_id', $user->teacher?->id)
            )
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => CourseResource::collection($courses),
        ]);
    }

    public function attendanceSession(ShowAttendanceSessionRequest $request, Course $course, AttendanceService $attendance): JsonResponse
    {
        $this->authorize('view', $course);

        $date = $request->validated('attendance_date');

        return response()->json([
            'data' => $attendance->sessionRoster($course, $date),
        ]);
    }
}
