<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StudentArtifact extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'reading_material_id',
        'student_id',
        'nodes',
        'connections',
    ];

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

    protected function casts(): array
    {
        return [
            'nodes' => 'array',
            'connections' => 'array',
        ];
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
