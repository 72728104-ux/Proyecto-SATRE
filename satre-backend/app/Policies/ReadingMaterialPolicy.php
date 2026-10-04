<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ReadingMaterial;
use App\Models\User;
use App\Support\Roles;

class ReadingMaterialPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::STUDENT);
    }

    public function view(User $user, ReadingMaterial $readingMaterial): bool
    {
        if ($user->hasRole(Roles::ADMIN)) {
            return true;
        }

        if ($user->hasRole(Roles::TEACHER)) {
            return $this->teachesCourse($user, $readingMaterial->course);
        }

        if ($user->hasRole(Roles::STUDENT)) {
            return $this->enrolledInCourse($user, $readingMaterial->course_id);
        }

        return false;
    }

    public function create(User $user, ?Course $course = null): bool
    {
        if (! $user->hasRole(Roles::TEACHER) || $course === null) {
            return $user->hasRole(Roles::TEACHER);
        }

        return $this->teachesCourse($user, $course);
    }

    public function update(User $user, ReadingMaterial $readingMaterial): bool
    {
        return $user->hasRole(Roles::TEACHER) && $this->teachesCourse($user, $readingMaterial->course);
    }

    private function teachesCourse(User $user, ?Course $course): bool
    {
        return $course !== null && $user->teacher !== null && $user->teacher->id === $course->teacher_id;
    }

    private function enrolledInCourse(User $user, int $courseId): bool
    {
        $studentId = $user->student?->id;

        if ($studentId === null) {
            return false;
        }

        return Enrollment::query()
            ->where('student_id', $studentId)
            ->where('course_id', $courseId)
            ->where('status', 'active')
            ->exists();
    }
}
