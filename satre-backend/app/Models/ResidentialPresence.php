<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResidentialPresence extends Model
{
    public const CHECK_TYPES = ['night', 'morning'];

    public const STATUSES = ['present', 'absent', 'on_permission'];

    protected $fillable = [
        'student_id',
        'presence_date',
        'check_type',
        'status',
        'recorded_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'presence_date' => 'date',
        ];
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(Roles::STUDENT)) {
            return $query->where('student_id', $user->student?->id ?? 0);
        }

        return $query;
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
