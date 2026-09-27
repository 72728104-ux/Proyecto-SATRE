<?php

namespace App\Events;

use App\Models\RiskPrediction;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RiskEvaluated
{
    use Dispatchable, SerializesModels;

    public function __construct(public RiskPrediction $prediction) {}
}
