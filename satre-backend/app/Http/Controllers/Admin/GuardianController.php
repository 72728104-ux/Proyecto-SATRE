<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LinkGuardianStudentRequest;
use App\Http\Resources\Admin\GuardianResource;
use App\Models\Guardian;
use App\Services\Admin\GuardianService;

class GuardianController extends Controller
{
    public function linkStudent(LinkGuardianStudentRequest $request, Guardian $guardian, GuardianService $guardianService): GuardianResource
    {
        $this->authorize('linkStudent', $guardian);

        return new GuardianResource($guardianService->linkStudent($request->user(), $guardian, $request->validated()));
    }
}
