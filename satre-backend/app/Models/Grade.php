<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Grade extends Model
{
    public const MIN_SCORE = 1;

    public const MAX_SCORE = 7;

    public const PASSING_SCORE = 4;

    public const CRITERIA = ['A', 'B', 'C', 'D'];

    protected $fillable = [
        'student_id',
        'course_id',
        'academic_period_id',
        'evaluation_name',
        'criterion',
        'evaluation_date',
        'score',
        'max_score',
        'recorded_by',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'max_score' => 'integer',
            'evaluation_date' => 'date',
            'recorded_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(Roles::ADMIN)) {
            return $query;
        }

        if ($user->hasRole(Roles::STUDENT)) {
            return $query->where('student_id', $user->student?->id ?? 0);
        }

        return $query->whereHas('course', fn (Builder $course) => $course->where('teacher_id', $user->teacher?->id ?? 0));
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function academicPeriod(): BelongsTo
    {
        return $this->belongsTo(AcademicPeriod::class);
    }
}
