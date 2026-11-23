<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\GuidedQuestion;
use App\Models\QuizAttempt;
use App\Models\ReadingMaterial;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuizAttemptService
{
    public function submit(User $studentUser, ReadingMaterial $reading, array $data): QuizAttempt
    {
        $student = $studentUser->student;

        if ($student === null) {
            throw ValidationException::withMessages([
                'answers' => 'El usuario no tiene perfil de estudiante.',
            ]);
        }

        $enrolled = Enrollment::query()
            ->where('student_id', $student->id)
            ->where('course_id', $reading->course_id)
            ->where('status', 'active')
            ->exists();

        if (! $enrolled) {
            throw ValidationException::withMessages([
                'answers' => 'El estudiante no está matriculado en el curso de esta lectura.',
            ]);
        }

        $questions = GuidedQuestion::query()
            ->where('reading_material_id', $reading->id)
            ->orderBy('id')
            ->get()
            ->keyBy('id');

        if ($questions->isEmpty()) {
            throw ValidationException::withMessages([
                'answers' => 'No hay preguntas guía para este quiz.',
            ]);
        }

        $answersByQuestion = collect($data['answers'])->keyBy('guided_question_id');

        foreach ($answersByQuestion->keys() as $questionId) {
            if (! $questions->has($questionId)) {
                throw ValidationException::withMessages([
                    'answers' => 'Hay respuestas que no pertenecen a esta lectura.',
                ]);
            }
        }

        $correctCount = 0;
        $results = [];

        foreach ($questions as $question) {
            $answer = $answersByQuestion->get($question->id);
            $given = is_array($answer) ? (string) ($answer['response'] ?? '') : '';
            $isCorrect = $given !== '' && $question->isCorrectResponse($given);

            if ($isCorrect) {
                $correctCount++;
            }

            $results[] = [
                'guided_question_id' => $question->id,
                'is_correct' => $isCorrect,
                'feedback' => $question->feedbackFor($isCorrect),
            ];
        }

        $total = $questions->count();
        $score = round(($correctCount / $total) * 100, 2);

        return DB::transaction(function () use ($reading, $student, $score, $total, $correctCount, $results) {
            $attempt = QuizAttempt::query()->create([
                'reading_material_id' => $reading->id,
                'student_id' => $student->id,
                'score' => $score,
                'total_questions' => $total,
                'correct_count' => $correctCount,
                'completed_at' => now(),
            ]);

            $attempt->setAttribute('results', $results);

            return $attempt;
        });
    }
}
