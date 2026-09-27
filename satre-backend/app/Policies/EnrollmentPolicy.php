<?php

namespace App\Policies;

use App\Models\Enrollment;
use App\Models\User;
use App\Support\Roles;

class EnrollmentPolicy
{
    public function create(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function delete(User $user, Enrollment $enrollment): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
