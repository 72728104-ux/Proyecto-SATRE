<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Roles;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function view(User $user, User $model): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function update(User $user, User $model): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function delete(User $user, User $model): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function toggleActive(User $user, User $model): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function resetPassword(User $user, User $model): bool
    {
        return $user->hasRole(Roles::ADMIN);
    }

    public function viewMe(User $user, User $model): bool
    {
        return $user->is($model) && $user->is_active;
    }

    public function refreshToken(User $user, User $model): bool
    {
        return $user->is($model) && $user->is_active;
    }

    public function logout(User $user, User $model): bool
    {
        return $user->is($model);
    }

    public function changePassword(User $user, User $model): bool
    {
        return $user->is($model) && $user->is_active;
    }
}
