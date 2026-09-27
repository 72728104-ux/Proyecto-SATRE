<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PermissionRequest extends Model
{
    public const STATUS_PENDING_GUARDIAN = 'pending_guardian';

    public const STATUS_APPROVED_GUARDIAN = 'approved_guardian';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_PENDING_GUARDIAN,
        self::STATUS_APPROVED_GUARDIAN,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
        self::STATUS_CANCELLED,
    ];

    public const DECISIONS = ['approved', 'rejected'];

    protected $fillable = [
        'student_id',
        'requested_by',
        'guardian_id',
        'type',
        'reason',
        'starts_at',
        'ends_at',
        'status',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(Roles::STUDENT)) {
            return $query->where('student_id', $user->student?->id ?? 0);
        }

        if ($user->hasRole(Roles::GUARDIAN)) {
            return $query->whereHas('student.guardians', fn (Builder $guardian) => $guardian->where('guardians.id', $user->guardian?->id ?? 0));
        }

        return $query;
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function guardian(): BelongsTo
    {
        return $this->belongsTo(Guardian::class);
    }
}
