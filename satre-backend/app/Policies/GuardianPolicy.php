<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Roles;

class GuardianPolicy
{
    public function linkStudent(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
