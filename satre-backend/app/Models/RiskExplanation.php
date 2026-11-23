<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskExplanation extends Model
{
    protected $fillable = [
        'risk_prediction_id',
        'method',
        'explanation_payload',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'explanation_payload' => 'array',
            'generated_at' => 'datetime',
        ];
    }

    public function prediction(): BelongsTo
    {
        return $this->belongsTo(RiskPrediction::class, 'risk_prediction_id');
    }
}
