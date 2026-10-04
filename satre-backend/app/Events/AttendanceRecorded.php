<?php

namespace App\Events;

use App\Models\Attendance;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * D2 / §4.7: solo auditoría y notificaciones. No dispara snapshots ni cálculo de riesgo.
 */
class AttendanceRecorded
{
    use Dispatchable, SerializesModels;

    public function __construct(public Attendance $attendance) {}
}
