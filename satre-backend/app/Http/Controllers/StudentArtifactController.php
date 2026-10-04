<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStudentArtifactRequest;
use App\Http\Resources\StudentArtifactResource;
use App\Models\ReadingMaterial;
use App\Models\StudentArtifact;
use App\Services\StudentArtifactService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StudentArtifactController extends Controller
{
    public function index(Request $request, ReadingMaterial $reading): AnonymousResourceCollection
    {
        $this->authorize('view', $reading);
        $this->authorize('viewAny', StudentArtifact::class);

        $artifacts = StudentArtifact::query()
            ->where('reading_material_id', $reading->id)
            ->visibleTo($request->user())
            ->with(['student:id,first_name,last_name'])
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return StudentArtifactResource::collection($artifacts);
    }

    public function store(StoreStudentArtifactRequest $request, ReadingMaterial $reading, StudentArtifactService $artifactService): JsonResponse
    {
        $this->authorize('create', [StudentArtifact::class, $reading]);

        $artifact = $artifactService->submit($request->user(), $reading, $request->validated());

        return (new StudentArtifactResource($artifact))
            ->response()
            ->setStatusCode(201);
    }
}
