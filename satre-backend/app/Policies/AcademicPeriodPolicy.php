<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Roles;

class AcademicPeriodPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function view(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function update(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function delete(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function setCurrent(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
