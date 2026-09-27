<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;
use App\Support\Roles;

class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER);
    }

    public function view(User $user, Course $course): bool
    {
        if ($user->hasRole(Roles::ADMIN)) {
            return true;
        }

        return $user->hasRole(Roles::TEACHER)
            && $user->teacher !== null
            && $user->teacher->id === $course->teacher_id;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function update(User $user, Course $course): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function delete(User $user, Course $course): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
