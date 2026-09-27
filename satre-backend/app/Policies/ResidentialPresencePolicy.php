<?php

namespace App\Policies;

use App\Models\ResidentialPresence;
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

    public function update(User $user, ResidentialPresence $presence): bool
    {
        return $user->hasRole(Roles::MONITOR);
    }
}
