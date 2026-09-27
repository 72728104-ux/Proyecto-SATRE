<?php

namespace App\Policies;

use App\Models\Alert;
use App\Models\User;
use App\Support\Roles;

class AlertPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::MONITOR, Roles::STUDENT, Roles::GUARDIAN);
    }

    public function view(User $user, Alert $alert): bool
    {
        return Alert::query()->whereKey($alert->id)->visibleTo($user)->exists();
    }

    public function viewDetail(User $user, Alert $alert): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::MONITOR, Roles::GUARDIAN)
            && $this->view($user, $alert);
    }

    public function update(User $user, Alert $alert): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::MONITOR) && $this->view($user, $alert);
    }

    public function createIntervention(User $user, Alert $alert): bool
    {
        return $this->update($user, $alert);
    }
}
