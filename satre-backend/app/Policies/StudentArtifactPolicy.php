<?php

namespace App\Policies;

use App\Policies\Concerns\AuthorizesReadingAccess;

class StudentArtifactPolicy
{
    use AuthorizesReadingAccess;
}
