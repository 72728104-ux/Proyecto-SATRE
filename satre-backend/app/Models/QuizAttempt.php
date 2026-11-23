<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizAttempt extends Model
{
    protected $fillable = [
        'reading_material_id',
        'student_id',
        'score',
        'total_questions',
        'correct_count',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'total_questions' => 'integer',
            'correct_count' => 'integer',
            'completed_at' => 'datetime',
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

        return $query->whereHas(
            'readingMaterial.course',
            fn (Builder $course) => $course->where('teacher_id', $user->teacher?->id ?? 0)
        );
    }

    public function readingMaterial(): BelongsTo
    {
        return $this->belongsTo(ReadingMaterial::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
