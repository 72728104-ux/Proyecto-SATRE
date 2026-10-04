<?php

namespace App\Policies;

use App\Models\Classroom;
use App\Models\User;
use App\Support\Roles;

class ClassroomPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function view(User $user, Classroom $classroom): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function viewInsights(User $user, Classroom $classroom): bool
    {
        if ($user->hasRole(Roles::ADMIN)) {
            return true;
        }

        $teacherId = $user->teacher?->id;

        return $user->hasRole(Roles::TEACHER) && $teacherId !== null && (
            (int) $classroom->tutor_id === $teacherId
            || $classroom->courses()->where('teacher_id', $teacherId)->exists()
        );
    }

    public function viewReports(User $user, Classroom $classroom): bool
    {
        return $this->viewInsights($user, $classroom);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function update(User $user, Classroom $classroom): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function delete(User $user, Classroom $classroom): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
