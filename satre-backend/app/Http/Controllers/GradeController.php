<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGradeRequest;
use App\Http\Requests\UpdateGradeRequest;
use App\Http\Resources\GradeResource;
use App\Models\Course;
use App\Models\Grade;
use App\Services\GradeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GradeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Grade::class);

        $grades = Grade::query()
            ->visibleTo($request->user())
            ->with(['student', 'course'])
            ->when($request->integer('course_id'), fn ($query, $courseId) => $query->where('course_id', $courseId))
            ->when($request->integer('student_id'), fn ($query, $studentId) => $query->where('student_id', $studentId))
            ->when($request->string('criterion')->toString(), fn ($query, $criterion) => $query->where('criterion', $criterion))
            ->orderByDesc('evaluation_date')
            ->paginate(15)
            ->withQueryString();

        return GradeResource::collection($grades);
    }

    public function store(StoreGradeRequest $request, GradeService $gradeService): JsonResponse
    {
        $course = Course::query()->findOrFail($request->validated('course_id'));
        $this->authorize('create', [Grade::class, $course]);

        $grade = $gradeService->record($request->user(), $request->validated());

        return (new GradeResource($grade))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateGradeRequest $request, Grade $grade, GradeService $gradeService): GradeResource
    {
        $this->authorize('update', $grade);

        return new GradeResource($gradeService->update($request->user(), $grade, $request->validated()));
    }
}
