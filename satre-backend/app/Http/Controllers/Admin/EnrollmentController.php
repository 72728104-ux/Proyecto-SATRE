<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ImportEnrollmentsRequest;
use App\Http\Requests\Admin\StoreEnrollmentRequest;
use App\Http\Resources\Admin\EnrollmentResource;
use App\Models\Enrollment;
use App\Services\Admin\EnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnrollmentController extends Controller
{
    public function store(StoreEnrollmentRequest $request, EnrollmentService $enrollmentService): JsonResponse
    {
        $this->authorize('create', Enrollment::class);

        $enrollment = $enrollmentService->enroll($request->user(), $request->validated());

        return (new EnrollmentResource($enrollment))
            ->response()
            ->setStatusCode(201);
    }

    public function import(ImportEnrollmentsRequest $request, EnrollmentService $enrollmentService): JsonResponse
    {
        $this->authorize('create', Enrollment::class);

        $summary = $enrollmentService->import(
            $request->user(),
            $request->file('file'),
            $request->integer('academic_period_id'),
        );

        return response()->json([
            'message' => 'Matrícula masiva procesada.',
            'data' => $summary,
        ]);
    }

    public function destroy(Request $request, Enrollment $enrollment, EnrollmentService $enrollmentService): JsonResponse
    {
        $this->authorize('delete', $enrollment);

        $enrollment = $enrollmentService->withdraw($request->user(), $enrollment);

        return response()->json([
            'message' => 'Matrícula retirada.',
            'data' => new EnrollmentResource($enrollment),
        ]);
    }
}
