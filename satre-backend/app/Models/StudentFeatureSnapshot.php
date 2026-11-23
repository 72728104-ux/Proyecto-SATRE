<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudentFeatureSnapshot extends Model
{
    protected $fillable = [
        'student_id',
        'academic_period_id',
        'snapshot_at',
        'attendance_rate',
        'residential_presence_rate',
        'academic_average',
        'failed_courses',
        'academic_trend',
        'incident_count',
        'tardiness_rate',
        'extra_features',
        'generated_by',
    ];

    protected function casts(): array
    {
        return [
            'snapshot_at' => 'datetime',
            'attendance_rate' => 'decimal:4',
            'residential_presence_rate' => 'decimal:4',
            'academic_average' => 'decimal:2',
            'academic_trend' => 'decimal:4',
            'tardiness_rate' => 'decimal:4',
            'extra_features' => 'array',
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

    public function riskPredictions(): HasMany
    {
        return $this->hasMany(RiskPrediction::class);
    }
}
