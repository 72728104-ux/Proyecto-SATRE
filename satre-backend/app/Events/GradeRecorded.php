<?php

namespace App\Events;

use App\Models\Grade;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Auditoría/notificaciones al registrar una nota.
 * El recálculo de riesgo lo dispara GradeObserver (created/updated).
 */
class GradeRecorded
{
    use Dispatchable, SerializesModels;

    public function __construct(public Grade $grade) {}
}
