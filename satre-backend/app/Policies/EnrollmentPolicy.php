<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Roles;

class EnrollmentPolicy
{
    public function create(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function delete(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
