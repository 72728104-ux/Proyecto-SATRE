<?php

namespace App\Models;

use Database\Factories\RiskPredictionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RiskPrediction extends Model
{
    /** @use HasFactory<RiskPredictionFactory> */
    use HasFactory;

    protected $fillable = [
        'student_id',
        'academic_period_id',
        'student_feature_snapshot_id',
        'risk_level',
        'risk_score',
        'factors',
        'data_coverage',
        'insufficient_data',
        'needs_human_review',
        'recommendation',
        'model_version',
        'predicted_at',
    ];

    public const LEVEL_LOW = 'BAJO';

    public const LEVEL_MEDIUM = 'MEDIO';

    public const LEVEL_HIGH = 'ALTO';

    protected function casts(): array
    {
        return [
            'predicted_at' => 'datetime',
            'risk_score' => 'decimal:2',
            'factors' => 'array',
            'data_coverage' => 'decimal:2',
            'insufficient_data' => 'boolean',
            'needs_human_review' => 'boolean',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function academicPeriod(): BelongsTo
    {
        return $this->belongsTo(AcademicPeriod::class);
    }

    public function snapshot(): BelongsTo
    {
        return $this->belongsTo(StudentFeatureSnapshot::class, 'student_feature_snapshot_id');
    }

    public function explanation(): HasOne
    {
        return $this->hasOne(RiskExplanation::class);
    }
}
