<?php

namespace App\Jobs;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Student;
use App\Services\AnalyticsClient;
use App\Services\AnalyticsService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * §4.7: recalcula riesgo e insights de un periodo (o de un aula) y guarda
 * risk_predictions + ai_diagnostics. Por defecto usa el periodo actual.
 */
class RunRiskBatchJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $timeout = 600;

    public function __construct(public ?int $periodId = null, public ?int $classroomId = null) {}

    public function uniqueId(): string
    {
        return ($this->periodId ?? 'current').':'.($this->classroomId ?? 'all');
    }

    public function handle(AnalyticsClient $client, AnalyticsService $analytics): void
    {
        $period = $this->periodId !== null
            ? AcademicPeriod::query()->find($this->periodId)
            : AcademicPeriod::query()->where('is_current', true)->first();

        if ($period === null) {
            return;
        }

        $batch = $client->batchRisk($period->id, $this->classroomId);

        if ($batch['available']) {
            foreach ($batch['results'] ?? [] as $result) {
                $analytics->storeRisk($result, $period->id);
            }
        } elseif (in_array($batch['status'], [404, 405], true)) {
            $this->evaluateOneByOne($period);
        } else {
            Log::warning('RunRiskBatchJob omitido: satre-analytics no disponible', ['period_id' => $period->id]);

            return;
        }

        Classroom::query()
            ->where('academic_period_id', $period->id)
            ->when($this->classroomId, fn ($query, $id) => $query->whereKey($id))
            ->each(fn (Classroom $classroom) => $analytics->refreshClassroomInsights($classroom));
    }

    private function evaluateOneByOne(AcademicPeriod $period): void
    {
        Student::query()
            ->where('status', 'active')
            ->whereHas('classroom', fn ($query) => $query->where('academic_period_id', $period->id))
            ->when($this->classroomId, fn ($query, $id) => $query->where('classroom_id', $id))
            ->select('id')
            ->chunkById(200, function ($students) use ($period) {
                foreach ($students as $student) {
                    EvaluateStudentRiskJob::dispatch($student->id, $period->id);
                }
            });
    }
}
