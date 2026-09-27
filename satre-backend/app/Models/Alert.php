<?php

namespace App\Models;

use App\Support\Roles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Alert extends Model
{
    public const TYPE_RISK = 'risk';

    public const STATUS_OPEN = 'open';

    public const STATUS_ACKNOWLEDGED = 'acknowledged';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUSES = [self::STATUS_OPEN, self::STATUS_ACKNOWLEDGED, self::STATUS_RESOLVED];

    /** Estados que cuentan como alerta abierta (§4.5: open → acknowledged → resolved). */
    public const OPEN_STATUSES = [self::STATUS_OPEN, self::STATUS_ACKNOWLEDGED];

    protected $fillable = [
        'student_id',
        'risk_prediction_id',
        'type',
        'severity',
        'title',
        'message',
        'status',
        'created_by',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function riskPrediction(): BelongsTo
    {
        return $this->belongsTo(RiskPrediction::class);
    }

    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class);
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }

    /**
     * §1: admin todo, teacher su aula/cursos, monitor internado, student propio, guardian hijos.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(Roles::ADMIN)) {
            return $query;
        }

        if ($user->hasRole(Roles::TEACHER)) {
            $teacherId = $user->teacher?->id ?? 0;

            return $query->whereHas('student', function (Builder $student) use ($teacherId) {
                $student->whereHas('classroom', fn (Builder $classroom) => $classroom->where('tutor_id', $teacherId))
                    ->orWhereHas(
                        'enrollments',
                        fn (Builder $enrollment) => $enrollment
                            ->where('status', 'active')
                            ->whereHas('course', fn (Builder $course) => $course->where('teacher_id', $teacherId))
                    );
            });
        }

        if ($user->hasRole(Roles::MONITOR)) {
            return $query->whereHas('student', fn (Builder $student) => $student->where('is_boarder', true));
        }

        if ($user->hasRole(Roles::STUDENT)) {
            return $query->where('student_id', $user->student?->id ?? 0);
        }

        if ($user->hasRole(Roles::GUARDIAN)) {
            return $query->whereHas(
                'student.guardians',
                fn (Builder $guardian) => $guardian->where('guardians.id', $user->guardian?->id ?? 0)
            );
        }

        return $query->whereRaw('1 = 0');
    }
}
