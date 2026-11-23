<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\AdminMetricsService;
use Illuminate\Http\JsonResponse;

class MetricsController extends Controller
{
    public function index(AdminMetricsService $metricsService): JsonResponse
    {
        $this->authorize('viewAdminMetrics');

        return response()->json([
            'data' => $metricsService->summary(),
        ]);
    }
}
