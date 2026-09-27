<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Roles;

class AuditLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }
}
