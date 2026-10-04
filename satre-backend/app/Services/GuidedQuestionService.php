<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\GuidedQuestion;
use App\Models\GuidedResponse;
use App\Models\ReadingMaterial;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class GuidedQuestionService
{
    public function answer(User $studentUser, ReadingMaterial $reading, array $data): GuidedResponse
    {
        $student = $studentUser->student;

        if ($student === null) {
            throw ValidationException::withMessages([
                'response' => 'El usuario no tiene perfil de estudiante.',
            ]);
        }

        $enrolled = Enrollment::query()
            ->where('student_id', $student->id)
            ->where('course_id', $reading->course_id)
            ->where('status', 'active')
            ->exists();

        if (! $enrolled) {
            throw ValidationException::withMessages([
                'response' => 'El estudiante no está matriculado en el curso de esta lectura.',
            ]);
        }

        $question = GuidedQuestion::query()
            ->where('reading_material_id', $reading->id)
            ->whereKey($data['guided_question_id'])
            ->first();

        if ($question === null) {
            throw ValidationException::withMessages([
                'guided_question_id' => 'La pregunta no pertenece a esta lectura.',
            ]);
        }

        $isCorrect = $question->isCorrectResponse($data['response']);

        $response = GuidedResponse::query()->create([
            'guided_question_id' => $question->id,
            'student_id' => $student->id,
            'response' => $data['response'],
            'is_correct' => $isCorrect,
        ]);

        $response->setRelation('guidedQuestion', $question);
        $response->setAttribute('feedback', $question->feedbackFor($isCorrect));

        return $response;
    }
}
