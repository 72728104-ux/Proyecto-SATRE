<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ClassroomRequest;
use App\Http\Resources\Admin\ClassroomResource;
use App\Models\Classroom;
use App\Services\Admin\ClassroomService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ClassroomController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Classroom::class);

        $classrooms = Classroom::query()
            ->with(['academicPeriod', 'tutor.user'])
            ->when($request->integer('academic_period_id'), fn ($query, $periodId) => $query->where('academic_period_id', $periodId))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return ClassroomResource::collection($classrooms);
    }

    public function show(Classroom $classroom): ClassroomResource
    {
        $this->authorize('view', $classroom);

        return new ClassroomResource($classroom->load(['academicPeriod', 'tutor.user']));
    }

    public function store(ClassroomRequest $request, ClassroomService $classroomService): JsonResponse
    {
        $this->authorize('create', Classroom::class);

        $classroom = $classroomService->create($request->user(), $request->validated());

        return (new ClassroomResource($classroom))
            ->response()
            ->setStatusCode(201);
    }

    public function update(ClassroomRequest $request, Classroom $classroom, ClassroomService $classroomService): ClassroomResource
    {
        $this->authorize('update', $classroom);

        return new ClassroomResource($classroomService->update($request->user(), $classroom, $request->validated()));
    }

    public function destroy(Request $request, Classroom $classroom, ClassroomService $classroomService): JsonResponse
    {
        $this->authorize('delete', $classroom);

        $classroomService->delete($request->user(), $classroom);

        return response()->json(['message' => 'Aula eliminada.']);
    }
}
