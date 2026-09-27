<?php

namespace App\Policies;

use App\Models\PermissionRequest;
use App\Models\User;
use App\Support\Roles;

class PermissionRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::MONITOR, Roles::STUDENT, Roles::GUARDIAN);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Roles::STUDENT) && $user->student !== null;
    }

    public function respondAsGuardian(User $user, PermissionRequest $permission): bool
    {
        return $user->hasRole(Roles::GUARDIAN)
            && $user->guardian !== null
            && $user->guardian->students()->where('students.id', $permission->student_id)->exists();
    }

    public function resolve(User $user, PermissionRequest $permission): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::MONITOR);
    }
}
