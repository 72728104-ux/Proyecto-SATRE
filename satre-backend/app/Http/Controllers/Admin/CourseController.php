<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CourseRequest;
use App\Http\Resources\Admin\CourseResource;
use App\Models\Course;
use App\Services\Admin\CourseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CourseController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Course::class);

        $courses = Course::query()
            ->with(['classroom', 'teacher.user', 'academicPeriod'])
            ->when($request->integer('academic_period_id'), fn ($query, $periodId) => $query->where('academic_period_id', $periodId))
            ->when($request->integer('classroom_id'), fn ($query, $classroomId) => $query->where('classroom_id', $classroomId))
            ->when($request->integer('teacher_id'), fn ($query, $teacherId) => $query->where('teacher_id', $teacherId))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return CourseResource::collection($courses);
    }

    public function show(Course $course): CourseResource
    {
        $this->authorize('view', $course);

        return new CourseResource($course->load(['classroom', 'teacher.user', 'academicPeriod']));
    }

    public function store(CourseRequest $request, CourseService $courseService): JsonResponse
    {
        $this->authorize('create', Course::class);

        $course = $courseService->create($request->user(), $request->validated());

        return (new CourseResource($course))
            ->response()
            ->setStatusCode(201);
    }

    public function update(CourseRequest $request, Course $course, CourseService $courseService): CourseResource
    {
        $this->authorize('update', $course);

        return new CourseResource($courseService->update($request->user(), $course, $request->validated()));
    }

    public function destroy(Request $request, Course $course, CourseService $courseService): JsonResponse
    {
        $this->authorize('delete', $course);

        $courseService->delete($request->user(), $course);

        return response()->json(['message' => 'Curso eliminado.']);
    }
}
