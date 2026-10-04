<?php

namespace Database\Factories;

use App\Models\AcademicPeriod;
use App\Models\RiskPrediction;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RiskPrediction>
 */
class RiskPredictionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'student_id' => Student::factory(),
            'academic_period_id' => AcademicPeriod::factory(),
            'student_feature_snapshot_id' => null,
            'risk_level' => RiskPrediction::LEVEL_MEDIUM,
            'risk_score' => 48.20,
            'factors' => [
                [
                    'key' => 'unexcused_absence',
                    'label' => 'Inasistencias injustificadas',
                    'value' => 0.12,
                    'contribution' => 15.0,
                ],
                [
                    'key' => 'grade_level',
                    'label' => 'Promedio IB',
                    'value' => 4.1,
                    'contribution' => 8.6,
                ],
            ],
            'data_coverage' => 0.90,
            'insufficient_data' => false,
            'needs_human_review' => false,
            'recommendation' => 'Monitoreo preventivo del aula.',
            'model_version' => 'rules-1.0',
            'predicted_at' => now(),
        ];
    }
}
