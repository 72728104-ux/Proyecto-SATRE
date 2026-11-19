<?php

namespace App\Policies;

use App\Policies\Concerns\AuthorizesReadingAccess;

class QuizAttemptPolicy
{
    use AuthorizesReadingAccess;
}
