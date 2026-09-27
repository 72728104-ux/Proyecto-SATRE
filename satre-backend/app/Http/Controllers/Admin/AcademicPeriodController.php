<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AcademicPeriodRequest;
use App\Http\Resources\Admin\AcademicPeriodResource;
use App\Models\AcademicPeriod;
use App\Services\Admin\AcademicPeriodService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AcademicPeriodController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', AcademicPeriod::class);

        $periods = AcademicPeriod::query()
            ->orderByDesc('start_date')
            ->paginate(15);

        return AcademicPeriodResource::collection($periods);
    }

    public function show(AcademicPeriod $period): AcademicPeriodResource
    {
        $this->authorize('view', $period);

        return new AcademicPeriodResource($period);
    }

    public function store(AcademicPeriodRequest $request, AcademicPeriodService $periodService): JsonResponse
    {
        $this->authorize('create', AcademicPeriod::class);

        $period = $periodService->create($request->user(), $request->validated());

        return (new AcademicPeriodResource($period))
            ->response()
            ->setStatusCode(201);
    }

    public function update(AcademicPeriodRequest $request, AcademicPeriod $period, AcademicPeriodService $periodService): AcademicPeriodResource
    {
        $this->authorize('update', $period);

        return new AcademicPeriodResource($periodService->update($request->user(), $period, $request->validated()));
    }

    public function destroy(Request $request, AcademicPeriod $period, AcademicPeriodService $periodService): JsonResponse
    {
        $this->authorize('delete', $period);

        $periodService->delete($request->user(), $period);

        return response()->json(['message' => 'Periodo eliminado.']);
    }

    public function setCurrent(Request $request, AcademicPeriod $period, AcademicPeriodService $periodService): JsonResponse
    {
        $this->authorize('setCurrent', $period);

        $period = $periodService->setCurrent($request->user(), $period);

        return response()->json([
            'message' => 'Periodo vigente actualizado.',
            'data' => new AcademicPeriodResource($period),
        ]);
    }
}
