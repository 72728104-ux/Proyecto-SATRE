<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReadingMaterial extends Model
{
    use SoftDeletes;

    public const CRITERIA = ['A', 'B', 'C', 'D'];

    protected $fillable = [
        'course_id',
        'title',
        'criterion',
        'content',
        'url',
        'created_by',
    ];

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(Roles::ADMIN)) {
            return $query;
        }

        if ($user->hasRole(Roles::STUDENT)) {
            $studentId = $user->student?->id ?? 0;

            return $query->whereHas(
                'course.enrollments',
                fn (Builder $enrollment) => $enrollment->where('student_id', $studentId)->where('status', 'active')
            );
        }

        return $query->whereHas(
            'course',
            fn (Builder $course) => $course->where('teacher_id', $user->teacher?->id ?? 0)
        );
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function artifacts(): HasMany
    {
        return $this->hasMany(StudentArtifact::class);
    }

    public function guidedQuestions(): HasMany
    {
        return $this->hasMany(GuidedQuestion::class);
    }

    public function quizAttempts(): HasMany
    {
        return $this->hasMany(QuizAttempt::class);
    }
}
