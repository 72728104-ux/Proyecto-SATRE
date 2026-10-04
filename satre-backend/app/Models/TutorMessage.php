<?php

namespace App\Models;

use Database\Factories\TutorMessageFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TutorMessage extends Model
{
    /** @use HasFactory<TutorMessageFactory> */
    use HasFactory;

    public const ROLE_STUDENT = 'student';

    public const ROLE_TUTOR = 'tutor';

    protected $fillable = [
        'tutor_session_id',
        'role',
        'content',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TutorSession::class, 'tutor_session_id');
    }
}
