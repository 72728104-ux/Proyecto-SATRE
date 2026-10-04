<?php

namespace App\Events;

use App\Models\Grade;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * D2 / §4.7: solo auditoría y notificaciones. No dispara snapshots ni cálculo de riesgo.
 */
class GradeRecorded
{
    use Dispatchable, SerializesModels;

    public function __construct(public Grade $grade) {}
}
