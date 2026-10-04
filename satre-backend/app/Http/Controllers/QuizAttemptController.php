<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreQuizAttemptRequest;
use App\Http\Resources\QuizAttemptResource;
use App\Models\QuizAttempt;
use App\Models\ReadingMaterial;
use App\Services\QuizAttemptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class QuizAttemptController extends Controller
{
    public function index(Request $request, ReadingMaterial $reading): AnonymousResourceCollection
    {
        $this->authorize('view', $reading);
        $this->authorize('viewAny', QuizAttempt::class);

        $attempts = QuizAttempt::query()
            ->where('reading_material_id', $reading->id)
            ->visibleTo($request->user())
            ->with(['student:id,first_name,last_name'])
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return QuizAttemptResource::collection($attempts);
    }

    public function store(StoreQuizAttemptRequest $request, ReadingMaterial $reading, QuizAttemptService $quizzes): JsonResponse
    {
        $this->authorize('view', $reading);
        $this->authorize('create', [QuizAttempt::class, $reading]);

        $attempt = $quizzes->submit($request->user(), $reading, $request->validated());

        return (new QuizAttemptResource($attempt))
            ->response()
            ->setStatusCode(201);
    }
}
