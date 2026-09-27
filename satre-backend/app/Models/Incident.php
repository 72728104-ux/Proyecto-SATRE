<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Incident extends Model
{
    public const CATEGORIES = ['conducta', 'salud', 'emocional', 'convivencia'];

    public const SEVERITIES = ['leve', 'moderada', 'grave'];

    public const STATUSES = ['open', 'resolved'];

    protected $fillable = [
        'student_id',
        'reported_by',
        'incident_at',
        'category',
        'severity',
        'description',
        'status',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'incident_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(Roles::GUARDIAN)) {
            return $query
                ->whereHas(
                    'student.guardians',
                    fn (Builder $guardian) => $guardian->where('guardians.id', $user->guardian?->id ?? 0)
                )
                ->whereIn('category', ['conducta', 'convivencia']);
        }

        if (! $user->hasRole(Roles::TEACHER)) {
            return $query;
        }

        return $query->whereHas('student.classroom', fn (Builder $classroom) => $classroom->where('tutor_id', $user->teacher?->id ?? 0));
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }
}
