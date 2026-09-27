<?php

namespace App\Events;

use App\Models\Incident;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class IncidentRecorded
{
    use Dispatchable, SerializesModels;

    public function __construct(public Incident $incident) {}
}
