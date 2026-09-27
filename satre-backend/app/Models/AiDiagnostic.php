<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiDiagnostic extends Model
{
    public const TYPE_TEACHER_INSIGHT = 'teacher_insight';

    public const TYPE_STUDENT_PROFILE = 'student_profile';

    protected $fillable = [
        'type',
        'student_id',
        'classroom_id',
        'academic_period_id',
        'payload',
        'model_version',
        'insufficient_data',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'insufficient_data' => 'boolean',
            'generated_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }
}
