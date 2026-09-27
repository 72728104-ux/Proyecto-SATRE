<?php

namespace App\Services\Admin;

use App\Models\Classroom;
use App\Models\Course;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Validation\ValidationException;

class CourseService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function create(User $admin, array $data): Course
    {
        $this->ensureClassroomInPeriod($data['classroom_id'], $data['academic_period_id']);

        $course = Course::query()->create($data);

        $this->auditLogger->record($admin, 'course.created', $course, [], $course->toArray());

        return $course->load(['classroom', 'teacher.user', 'academicPeriod']);
    }

    public function update(User $admin, Course $course, array $data): Course
    {
        $this->ensureClassroomInPeriod(
            $data['classroom_id'] ?? $course->classroom_id,
            $data['academic_period_id'] ?? $course->academic_period_id,
        );

        $old = $course->only(array_keys($data));
        $course->update($data);

        $this->auditLogger->record($admin, 'course.updated', $course, $old, $course->only(array_keys($data)));

        return $course->load(['classroom', 'teacher.user', 'academicPeriod']);
    }

    public function delete(User $admin, Course $course): void
    {
        if ($course->enrollments()->exists()) {
            throw ValidationException::withMessages([
                'course' => 'El curso tiene matrículas registradas; no puede eliminarse.',
            ]);
        }

        $this->auditLogger->record($admin, 'course.deleted', $course, $course->toArray(), []);
        $course->delete();
    }

    private function ensureClassroomInPeriod(int $classroomId, int $periodId): void
    {
        $classroomPeriodId = Classroom::query()->whereKey($classroomId)->value('academic_period_id');

        if ((int) $classroomPeriodId !== $periodId) {
            throw ValidationException::withMessages([
                'classroom_id' => 'El aula no pertenece al periodo académico indicado.',
            ]);
        }
    }
}
