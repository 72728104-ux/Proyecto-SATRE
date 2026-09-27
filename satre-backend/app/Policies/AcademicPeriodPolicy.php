<?php

namespace App\Policies;

use App\Models\AcademicPeriod;
use App\Models\User;
use App\Support\Roles;

class AcademicPeriodPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function view(User $user, AcademicPeriod $period): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function update(User $user, AcademicPeriod $period): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function delete(User $user, AcademicPeriod $period): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function setCurrent(User $user, AcademicPeriod $period): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
