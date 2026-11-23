<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReadingRequest;
use App\Http\Requests\UpdateReadingRequest;
use App\Http\Resources\ReadingMaterialResource;
use App\Models\Course;
use App\Models\ReadingMaterial;
use App\Services\ReadingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReadingController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ReadingMaterial::class);

        $readings = ReadingMaterial::query()
            ->visibleTo($request->user())
            ->with(['course:id,name,code,teacher_id', 'creator:id,name'])
            ->when($request->integer('course_id'), fn ($query, $courseId) => $query->where('course_id', $courseId))
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return ReadingMaterialResource::collection($readings);
    }

    public function store(StoreReadingRequest $request, ReadingService $readingService): JsonResponse
    {
        $course = Course::query()->findOrFail($request->validated('course_id'));
        $this->authorize('create', [ReadingMaterial::class, $course]);

        $reading = $readingService->create($request->user(), $request->validated());

        return (new ReadingMaterialResource($reading))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateReadingRequest $request, ReadingMaterial $reading, ReadingService $readingService): ReadingMaterialResource
    {
        $this->authorize('update', $reading);

        return new ReadingMaterialResource($readingService->update($reading, $request->validated()));
    }
}
