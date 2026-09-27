<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShowAttendanceSessionRequest;
use App\Http\Resources\CourseResource;
use App\Models\Attendance;
use App\Models\Course;
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

    public function attendanceSession(ShowAttendanceSessionRequest $request, Course $course): JsonResponse
    {
        $this->authorize('view', $course);
        $course->load('classroom');

        $date = $request->validated('attendance_date');

        $attendances = Attendance::query()
            ->where('course_id', $course->id)
            ->whereDate('attendance_date', $date)
            ->get()
            ->keyBy('student_id');

        $students = $course->enrollments()
            ->where('status', 'active')
            ->with('student')
            ->get()
            ->map(function ($enrollment) use ($attendances) {
                $student = $enrollment->student;
                $attendance = $attendances->get($student->id);

                return [
                    'student_id' => $student->id,
                    'student_code' => $student->student_code,
                    'first_name' => $student->first_name,
                    'last_name' => $student->last_name,
                    'status' => $attendance?->status,
                    'notes' => $attendance?->notes,
                ];
            })
            ->sortBy('last_name')
            ->values();

        return response()->json([
            'data' => [
                'course_id' => $course->id,
                'course_name' => $course->name,
                'classroom' => [
                    'id' => $course->classroom?->id,
                    'name' => $course->classroom?->name,
                ],
                'attendance_date' => $date,
                'students' => $students,
            ],
        ]);
    }
}
