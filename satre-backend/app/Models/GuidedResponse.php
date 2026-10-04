<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuidedResponse extends Model
{
    protected $fillable = [
        'guided_question_id',
        'student_id',
        'response',
        'is_correct',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
        ];
    }

    public function guidedQuestion(): BelongsTo
    {
        return $this->belongsTo(GuidedQuestion::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
