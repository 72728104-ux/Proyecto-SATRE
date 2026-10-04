<?php

namespace App\Http\Controllers;

use App\Http\Requests\SocraticTutorTurnRequest;
use App\Services\SocraticTutorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Alias /v1/tutor → mismas acciones que AnalyticsController (§4.6).
 */
class SocraticTutorController extends AnalyticsController
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return $this->socraticSessions($request);
    }

    public function store(SocraticTutorTurnRequest $request, SocraticTutorService $tutor): JsonResponse
    {
        return $this->socraticTurn($request, $tutor);
    }
}
