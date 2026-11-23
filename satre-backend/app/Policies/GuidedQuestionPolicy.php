<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Roles;

class GuidedQuestionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::STUDENT);
    }
}
