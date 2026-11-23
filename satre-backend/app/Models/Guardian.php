<?php

namespace App\Models;

use Database\Factories\GuardianFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Guardian extends Model
{
    /** @use HasFactory<GuardianFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'document_number',
        'first_name',
        'last_name',
        'phone',
        'email',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class)
            ->withPivot(['relationship', 'is_primary'])
            ->withTimestamps();
    }
}
