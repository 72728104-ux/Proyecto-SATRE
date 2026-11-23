<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBulkPresenceRequest;
use App\Http\Requests\StorePresenceRequest;
use App\Http\Requests\UpdatePresenceRequest;
use App\Http\Resources\ResidentialPresenceResource;
use App\Models\ResidentialPresence;
use App\Services\ResidentialPresenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ResidentialPresenceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ResidentialPresence::class);

        $presences = ResidentialPresence::query()
            ->visibleTo($request->user())
            ->with('student')
            ->when($request->integer('student_id'), fn ($query, $studentId) => $query->where('student_id', $studentId))
            ->when($request->date('presence_date'), fn ($query, $date) => $query->whereDate('presence_date', $date))
            ->when($request->string('check_type')->toString(), fn ($query, $checkType) => $query->where('check_type', $checkType))
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('presence_date')
            ->paginate(15)
            ->withQueryString();

        return ResidentialPresenceResource::collection($presences);
    }

    public function store(StorePresenceRequest $request, ResidentialPresenceService $presenceService): JsonResponse
    {
        $this->authorize('create', ResidentialPresence::class);

        $presence = $presenceService->record($request->user(), $request->validated());

        return (new ResidentialPresenceResource($presence))
            ->response()
            ->setStatusCode(201);
    }

    public function storeBulk(StoreBulkPresenceRequest $request, ResidentialPresenceService $presenceService): JsonResponse
    {
        $this->authorize('create', ResidentialPresence::class);

        $presences = $presenceService->recordBulk($request->user(), $request->validated());

        return response()->json([
            'message' => 'Presencias registradas.',
            'data' => ResidentialPresenceResource::collection($presences),
        ]);
    }

    public function update(UpdatePresenceRequest $request, ResidentialPresence $presence, ResidentialPresenceService $presenceService): ResidentialPresenceResource
    {
        $this->authorize('update', $presence);

        return new ResidentialPresenceResource($presenceService->update($request->user(), $presence, $request->validated()));
    }
}
