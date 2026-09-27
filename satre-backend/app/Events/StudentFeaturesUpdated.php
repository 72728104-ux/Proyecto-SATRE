<?php

namespace App\Events;

use App\Models\StudentFeatureSnapshot;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StudentFeaturesUpdated
{
    use Dispatchable, SerializesModels;

    public function __construct(public StudentFeatureSnapshot $snapshot) {}
}
