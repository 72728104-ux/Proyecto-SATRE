<?php

namespace App\Policies;

use App\Models\Enrollment;
use App\Models\ReadingMaterial;
use App\Models\User;
use App\Support\Roles;

class StudentArtifactPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::STUDENT);
    }

    public function create(User $user, ?ReadingMaterial $reading = null): bool
    {
        if (! $user->hasRole(Roles::STUDENT) || $user->student === null) {
            return false;
        }

        if ($reading === null) {
            return true;
        }

        return Enrollment::query()
            ->where('student_id', $user->student->id)
            ->where('course_id', $reading->course_id)
            ->where('status', 'active')
            ->exists();
    }
}
