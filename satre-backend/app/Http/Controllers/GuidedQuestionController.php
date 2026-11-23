<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGuidedResponseRequest;
use App\Http\Resources\GuidedQuestionResource;
use App\Http\Resources\GuidedResponseResource;
use App\Models\GuidedQuestion;
use App\Models\GuidedResponse;
use App\Models\ReadingMaterial;
use App\Services\GuidedQuestionService;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GuidedQuestionController extends Controller
{
    public function index(Request $request, ReadingMaterial $reading): AnonymousResourceCollection
    {
        $this->authorize('view', $reading);
        $this->authorize('viewAny', GuidedQuestion::class);

        $user = $request->user();
        $staff = $user->hasRole(Roles::ADMIN, Roles::TEACHER);

        $questions = GuidedQuestion::query()
            ->where('reading_material_id', $reading->id)
            ->when($staff, fn ($query) => $query->withCount([
                'responses',
                'responses as correct_responses_count' => fn ($responses) => $responses->where('is_correct', true),
            ]))
            ->when(
                $user->hasRole(Roles::STUDENT),
                fn ($query) => $query->with([
                    'responses' => fn ($responses) => $responses
                        ->where('student_id', $user->student?->id ?? 0)
                        ->latest('id'),
                ])
            )
            ->orderBy('id')
            ->paginate(15)
            ->withQueryString();

        return GuidedQuestionResource::collection($questions);
    }

    public function store(StoreGuidedResponseRequest $request, ReadingMaterial $reading, GuidedQuestionService $questions): JsonResponse
    {
        $this->authorize('view', $reading);
        $this->authorize('create', [GuidedResponse::class, $reading]);

        $response = $questions->answer($request->user(), $reading, $request->validated());

        return (new GuidedResponseResource($response))
            ->response()
            ->setStatusCode(201);
    }
}
