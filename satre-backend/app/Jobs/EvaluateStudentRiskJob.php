<?php

namespace App\Jobs;

use App\Services\AnalyticsService;
use App\Services\PythonAnalyticsClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class EvaluateStudentRiskJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $studentId, public int $periodId) {}

    public function handle(PythonAnalyticsClient $client, AnalyticsService $analytics): void
    {
        $result = $client->studentRisk($this->studentId, $this->periodId);

        if (! $result['available']) {
            return;
        }

        $analytics->storeRisk($result, $this->periodId);
    }
}
