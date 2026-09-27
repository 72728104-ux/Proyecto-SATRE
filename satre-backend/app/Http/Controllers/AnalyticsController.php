<?php

namespace App\Http\Controllers;

use App\Http\Resources\RiskPredictionResource;
use App\Models\Classroom;
use App\Models\Student;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function teacherInsights(Classroom $classroom, AnalyticsService $analytics): JsonResponse
    {
        $this->authorize('viewInsights', $classroom);

        return response()->json($analytics->classroomInsights($classroom));
    }

    public function studentRisk(Request $request, Student $student, AnalyticsService $analytics): JsonResponse
    {
        $this->authorize('viewRisk', $student);

        $prediction = $analytics->predictionFor(
            $student,
            $request->user()->can('viewRiskDetail', $student),
        );

        return response()->json([
            'available' => $prediction !== null,
            'data' => $prediction ? new RiskPredictionResource($prediction->setRelation('student', $student)) : null,
        ]);
    }
}
