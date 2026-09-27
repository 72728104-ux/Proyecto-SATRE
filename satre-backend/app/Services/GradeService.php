<?php

namespace App\Services;

use App\Events\GradeRecorded;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class GradeService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function record(User $recorder, array $data): Grade
    {
        $course = Course::query()->findOrFail($data['course_id']);

        $enrolled = Enrollment::query()
            ->where('student_id', $data['student_id'])
            ->where('course_id', $course->id)
            ->where('status', 'active')
            ->exists();

        if (! $enrolled) {
            throw ValidationException::withMessages([
                'student_id' => 'El estudiante no está matriculado en el curso.',
            ]);
        }

        $grade = Grade::query()->create([
            'student_id' => $data['student_id'],
            'course_id' => $course->id,
            'academic_period_id' => $course->academic_period_id,
            'evaluation_name' => $data['evaluation_name'],
            'criterion' => $data['criterion'] ?? null,
            'evaluation_date' => $data['evaluation_date'],
            'score' => $data['score'],
            'max_score' => Grade::MAX_SCORE,
            'recorded_by' => $recorder->id,
            'recorded_at' => now(),
        ]);

        $this->auditLogger->record($recorder, 'grade.recorded', $grade, [], $grade->toArray());

        GradeRecorded::dispatch($grade);

        return $grade->load(['student', 'course']);
    }

    public function update(User $recorder, Grade $grade, array $data): Grade
    {
        $grade->fill($data);
        $oldValues = array_intersect_key($grade->getRawOriginal(), $grade->getDirty());
        $grade->save();

        $this->auditLogger->record($recorder, 'grade.updated', $grade, $oldValues, Arr::except($grade->getChanges(), 'updated_at'));

        return $grade->load(['student', 'course']);
    }
}
