<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFollowUpRequest;
use App\Http\Requests\StoreInterventionRequest;
use App\Http\Requests\UpdateAlertRequest;
use App\Http\Resources\AlertResource;
use App\Http\Resources\FollowUpResource;
use App\Http\Resources\InterventionResource;
use App\Models\Alert;
use App\Models\Intervention;
use App\Services\AlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AlertController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Alert::class);

        $alerts = Alert::query()
            ->visibleTo($request->user())
            ->with(['student:id,first_name,last_name', 'interventions.followUps'])
            ->when($request->integer('classroom_id'), fn ($query, $id) => $query->whereHas(
                'student',
                fn ($student) => $student->where('classroom_id', $id)
            ))
            ->when($request->integer('student_id'), fn ($query, $id) => $query->where('student_id', $id))
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return AlertResource::collection($alerts);
    }

    public function update(UpdateAlertRequest $request, Alert $alert, AlertService $alerts): AlertResource
    {
        $this->authorize('update', $alert);

        return new AlertResource($alerts->changeStatus($request->user(), $alert, $request->validated('status')));
    }

    public function storeIntervention(StoreInterventionRequest $request, Alert $alert, AlertService $alerts): JsonResponse
    {
        $this->authorize('createIntervention', $alert);

        $intervention = $alerts->createIntervention($request->user(), $alert, $request->validated());

        return (new InterventionResource($intervention))
            ->response()
            ->setStatusCode(201);
    }

    public function storeFollowUp(StoreFollowUpRequest $request, Intervention $intervention, AlertService $alerts): JsonResponse
    {
        $this->authorize('createFollowUp', $intervention);

        $followUp = $alerts->createFollowUp($request->user(), $intervention, $request->validated());

        return (new FollowUpResource($followUp))
            ->response()
            ->setStatusCode(201);
    }
}
