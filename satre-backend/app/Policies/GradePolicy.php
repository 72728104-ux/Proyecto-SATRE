<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\Grade;
use App\Models\User;
use App\Support\Roles;

class GradePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::STUDENT);
    }

    public function create(User $user, ?Course $course = null): bool
    {
        if (! $user->hasRole(Roles::TEACHER) || $course === null) {
            return $user->hasRole(Roles::TEACHER);
        }

        return $this->teachesCourse($user, $course);
    }

    public function update(User $user, Grade $grade): bool
    {
        return $user->hasRole(Roles::TEACHER) && $this->teachesCourse($user, $grade->course);
    }

    private function teachesCourse(User $user, ?Course $course): bool
    {
        return $course !== null && $user->teacher !== null && $user->teacher->id === $course->teacher_id;
    }
}
