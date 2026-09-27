<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShowMeSummaryRequest;
use App\Models\Student;
use App\Services\StudentSummaryService;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;

class MeSummaryController extends Controller
{
    public function show(ShowMeSummaryRequest $request, StudentSummaryService $summaryService): JsonResponse
    {
        $user = $request->user();

        $student = $user->hasRole(Roles::GUARDIAN)
            ? Student::query()->findOrFail($request->validated('student_id'))
            : $user->student;

        abort_if($student === null, 404, 'Perfil de estudiante no encontrado.');

        $this->authorize('viewSummary', $student);

        return response()->json([
            'data' => $summaryService->build($student),
        ]);
    }
}
