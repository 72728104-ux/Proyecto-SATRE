<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Roles;

class ResidentialPresencePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::MONITOR, Roles::STUDENT);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Roles::MONITOR);
    }

    public function update(User $user): bool
    {
        return $user->hasRole(Roles::MONITOR);
    }
}
