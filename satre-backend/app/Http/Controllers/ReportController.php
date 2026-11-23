<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExportClassroomReportRequest;
use App\Models\Classroom;
use App\Models\Student;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class ReportController extends Controller
{
    public function studentPerformance(Student $student, ReportService $reports): JsonResponse
    {
        $this->authorize('viewPerformance', $student);

        return response()->json([
            'data' => $reports->studentPerformance($student),
        ]);
    }

    public function classroomAnalytics(Classroom $classroom, ReportService $reports): JsonResponse
    {
        $this->authorize('viewReports', $classroom);

        return response()->json([
            'data' => $reports->classroomAnalytics($classroom),
        ]);
    }

    public function exportClassroom(ExportClassroomReportRequest $request, Classroom $classroom, ReportService $reports): Response
    {
        $this->authorize('viewReports', $classroom);

        return $reports->exportClassroom($classroom, $request->validated('format'));
    }
}
