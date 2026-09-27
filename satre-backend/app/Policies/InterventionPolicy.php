<?php

namespace App\Policies;

use App\Models\Intervention;
use App\Models\User;
use App\Support\Roles;

class InterventionPolicy
{
    public function createFollowUp(User $user, Intervention $intervention): bool
    {
        $alert = $intervention->alert;

        return $alert !== null
            && $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::MONITOR)
            && $user->can('update', $alert);
    }
}
