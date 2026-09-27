<?php

namespace App\Events;

use App\Models\Grade;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GradeRecorded
{
    use Dispatchable, SerializesModels;

    public function __construct(public Grade $grade) {}
}
