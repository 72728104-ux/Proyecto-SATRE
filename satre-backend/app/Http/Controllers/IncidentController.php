<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreIncidentRequest;
use App\Http\Requests\UpdateIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use App\Services\IncidentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class IncidentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Incident::class);

        $incidents = Incident::query()
            ->visibleTo($request->user())
            ->with('student')
            ->when($request->integer('student_id'), fn ($query, $studentId) => $query->where('student_id', $studentId))
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->when($request->string('severity')->toString(), fn ($query, $severity) => $query->where('severity', $severity))
            ->orderByDesc('incident_at')
            ->paginate(15)
            ->withQueryString();

        return IncidentResource::collection($incidents);
    }

    public function store(StoreIncidentRequest $request, IncidentService $incidentService): JsonResponse
    {
        $this->authorize('create', Incident::class);

        $incident = $incidentService->record($request->user(), $request->validated());

        return (new IncidentResource($incident))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateIncidentRequest $request, Incident $incident, IncidentService $incidentService): IncidentResource
    {
        $this->authorize('update', $incident);

        return new IncidentResource($incidentService->update($request->user(), $incident, $request->validated()));
    }
}
