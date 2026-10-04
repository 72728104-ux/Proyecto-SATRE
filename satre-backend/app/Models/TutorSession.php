<?php

namespace App\Models;

use Database\Factories\TutorSessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TutorSession extends Model
{
    /** @use HasFactory<TutorSessionFactory> */
    use HasFactory;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_NO_CATALOG = 'no_catalog';

    protected $fillable = [
        'student_id',
        'course_id',
        'topic',
        'criterion',
        'state',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'state' => 'array',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TutorMessage::class)->orderBy('id');
    }
}
