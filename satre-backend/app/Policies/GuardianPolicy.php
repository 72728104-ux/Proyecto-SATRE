<?php

namespace App\Policies;

use App\Models\Guardian;
use App\Models\User;
use App\Support\Roles;

class GuardianPolicy
{
    public function linkStudent(User $user, Guardian $guardian): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
