<?php

namespace App\Http\Controllers;

use App\Http\Requests\DecidePermissionRequest;
use App\Http\Requests\StorePermissionRequest;
use App\Http\Resources\PermissionRequestResource;
use App\Models\PermissionRequest;
use App\Services\PermissionRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PermissionRequestController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', PermissionRequest::class);

        $permissions = PermissionRequest::query()
            ->visibleTo($request->user())
            ->with('student')
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->when($request->integer('student_id'), fn ($query, $studentId) => $query->where('student_id', $studentId))
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return PermissionRequestResource::collection($permissions);
    }

    public function store(StorePermissionRequest $request, PermissionRequestService $permissionService): JsonResponse
    {
        $this->authorize('create', PermissionRequest::class);

        $permission = $permissionService->request($request->user(), $request->validated());

        return (new PermissionRequestResource($permission))
            ->response()
            ->setStatusCode(201);
    }

    public function respondAsGuardian(DecidePermissionRequest $request, PermissionRequest $permission, PermissionRequestService $permissionService): PermissionRequestResource
    {
        $this->authorize('respondAsGuardian', $permission);

        return new PermissionRequestResource(
            $permissionService->respondAsGuardian($request->user(), $permission, $request->validated('decision'))
        );
    }

    public function resolve(DecidePermissionRequest $request, PermissionRequest $permission, PermissionRequestService $permissionService): PermissionRequestResource
    {
        $this->authorize('resolve', $permission);

        return new PermissionRequestResource(
            $permissionService->resolve($request->user(), $permission, $request->validated('decision'))
        );
    }
}
