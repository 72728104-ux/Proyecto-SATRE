<?php

namespace App\Jobs;

use App\Models\Student;
use App\Services\AnalyticsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class EvaluateStudentRiskJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $studentId, public int $periodId) {}

    public function handle(AnalyticsService $analytics): void
    {
        $student = Student::query()->find($this->studentId);

        if ($student === null) {
            return;
        }

        $analytics->refreshStudentRisk($student, $this->periodId);
    }
}
