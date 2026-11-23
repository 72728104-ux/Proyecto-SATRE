<?php

namespace Database\Factories;

use App\Models\Guardian;
use App\Models\PermissionRequest;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PermissionRequest>
 */
class PermissionRequestFactory extends Factory
{
    public function definition(): array
    {
        $startsAt = now()->addDays(2)->setTime(8, 0);

        return [
            'student_id' => Student::factory(),
            'requested_by' => User::factory()->student(),
            'guardian_id' => Guardian::factory(),
            'type' => 'salida',
            'reason' => 'Cita médica en Huancayo',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addHours(8),
            'status' => PermissionRequest::STATUS_PENDING_GUARDIAN,
            'reviewed_by' => null,
            'reviewed_at' => null,
        ];
    }
}
