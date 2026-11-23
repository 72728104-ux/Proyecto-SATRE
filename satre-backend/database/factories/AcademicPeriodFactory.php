<?php

namespace Database\Factories;

use App\Models\AcademicPeriod;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AcademicPeriod>
 */
class AcademicPeriodFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => '2026-I',
            'start_date' => '2026-03-01',
            'end_date' => '2026-07-31',
            'is_current' => true,
        ];
    }
}
