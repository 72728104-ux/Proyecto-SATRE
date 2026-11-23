<?php

namespace App\Observers;

use App\Jobs\EvaluateStudentRiskJob;
use App\Models\Grade;

class GradeObserver
{
    public function created(Grade $grade): void
    {
        $this->refreshStudentRisk($grade);
    }

    public function updated(Grade $grade): void
    {
        $this->refreshStudentRisk($grade);
    }

    private function refreshStudentRisk(Grade $grade): void
    {
        $studentId = (int) $grade->student_id;
        $periodId = (int) $grade->academic_period_id;

        if ($studentId < 1 || $periodId < 1) {
            return;
        }

        EvaluateStudentRiskJob::dispatch($studentId, $periodId);
    }
}
