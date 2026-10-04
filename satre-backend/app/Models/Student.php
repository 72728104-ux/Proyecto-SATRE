<?php

namespace App\Models;

use Database\Factories\StudentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    /** @use HasFactory<StudentFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'student_code',
        'document_number',
        'first_name',
        'last_name',
        'status',
        'is_boarder',
        'classroom_id',
    ];

    protected function casts(): array
    {
        return [
            'is_boarder' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function guardians(): BelongsToMany
    {
        return $this->belongsToMany(Guardian::class)
            ->withPivot(['relationship', 'is_primary'])
            ->withTimestamps();
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function residentialPresences(): HasMany
    {
        return $this->hasMany(ResidentialPresence::class);
    }

    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class);
    }

    public function featureSnapshots(): HasMany
    {
        return $this->hasMany(StudentFeatureSnapshot::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }

    public function permissionRequests(): HasMany
    {
        return $this->hasMany(PermissionRequest::class);
    }

    public function riskPredictions(): HasMany
    {
        return $this->hasMany(RiskPrediction::class);
    }

    public function aiDiagnostics(): HasMany
    {
        return $this->hasMany(AiDiagnostic::class);
    }

    public function tutorSessions(): HasMany
    {
        return $this->hasMany(TutorSession::class);
    }

    public function artifacts(): HasMany
    {
        return $this->hasMany(StudentArtifact::class);
    }

    public function guidedResponses(): HasMany
    {
        return $this->hasMany(GuidedResponse::class);
    }

    public function quizAttempts(): HasMany
    {
        return $this->hasMany(QuizAttempt::class);
    }
}
