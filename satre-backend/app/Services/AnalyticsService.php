<?php

namespace App\Services;

use App\Events\RiskEvaluated;
use App\Models\AcademicPeriod;
use App\Models\AiDiagnostic;
use App\Models\Classroom;
use App\Models\RiskPrediction;
use App\Models\Student;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    private const INSIGHT_TTL_HOURS = 24;

    private const RISK_TTL_HOURS = 24;

    public function __construct(
        private readonly PythonAnalyticsClient $client,
    ) {}

    /**
     * Lee ai_diagnostics; si no existe o tiene más de 24 h, pide a Python y guarda.
     */
    public function classroomInsights(Classroom $classroom): array
    {
        $cached = AiDiagnostic::query()
            ->where('type', AiDiagnostic::TYPE_TEACHER_INSIGHT)
            ->where('classroom_id', $classroom->id)
            ->where('academic_period_id', $classroom->academic_period_id)
            ->latest('generated_at')
            ->first();

        if ($cached !== null && $cached->generated_at->gt(now()->subHours(self::INSIGHT_TTL_HOURS))) {
            return $this->insightResponse($cached, available: true, stale: false);
        }

        $fresh = $this->refreshClassroomInsights($classroom);

        if ($fresh !== null) {
            return $this->insightResponse($fresh, available: true, stale: false);
        }

        return $cached !== null
            ? $this->insightResponse($cached, available: false, stale: true)
            : ['available' => false, 'stale' => false, 'generated_at' => null, 'data' => null];
    }

    public function refreshClassroomInsights(Classroom $classroom): ?AiDiagnostic
    {
        $result = $this->client->classroomInsights($classroom->id, $classroom->academic_period_id);

        if (! $result['available']) {
            return null;
        }

        return $this->storeDiagnostic(AiDiagnostic::TYPE_TEACHER_INSIGHT, [
            'classroom_id' => $classroom->id,
            'academic_period_id' => $classroom->academic_period_id,
        ], $result);
    }

    public function latestPrediction(Student $student): ?RiskPrediction
    {
        return RiskPrediction::query()
            ->where('student_id', $student->id)
            ->latest('predicted_at')
            ->latest('id')
            ->first();
    }

    /**
     * Staff puede refrescar si no hay predicción, está vencida (>24 h) o se fuerza (`refresh=1`).
     * Student/guardian solo leen lo guardado. Si Python cae se devuelve el cache o available:false.
     */
    public function predictionFor(Student $student, bool $refreshIfStale = false, bool $force = false): ?RiskPrediction
    {
        $prediction = $this->latestPrediction($student);

        if ($force) {
            return $this->refreshStudentRisk($student) ?? $prediction;
        }

        if (! $refreshIfStale || $this->isFresh($prediction)) {
            return $prediction;
        }

        $periodId = $student->classroom?->academic_period_id
            ?? AcademicPeriod::query()->where('is_current', true)->value('id');

        if ($periodId === null) {
            return $prediction;
        }

        if ($student->classroom_id) {
            $this->refreshClassroomRiskOnce((int) $student->classroom_id, (int) $periodId);

            return $this->latestPrediction($student) ?? $prediction;
        }

        return $this->refreshStudentRisk($student, (int) $periodId) ?? $prediction;
    }

    public function refreshStudentRisk(Student $student, ?int $periodId = null): ?RiskPrediction
    {
        $student->loadMissing('classroom');

        $periodId ??= $student->classroom?->academic_period_id
            ?? AcademicPeriod::query()->where('is_current', true)->value('id');

        if ($periodId === null) {
            return $this->latestPrediction($student);
        }

        $result = $this->client->studentRisk($student->id, (int) $periodId);

        return $result['available']
            ? $this->storeRisk($result, (int) $periodId)
            : $this->latestPrediction($student);
    }

    /**
     * Guarda una predicción con el contrato §5.4 y su perfil en ai_diagnostics.
     * RiskEvaluated dispara CreateAlertsFromRisk.
     */
    public function storeRisk(array $result, int $periodId): ?RiskPrediction
    {
        $studentId = (int) ($result['student_id'] ?? 0);

        if (! Student::query()->whereKey($studentId)->exists()) {
            return null;
        }

        $prediction = DB::transaction(function () use ($result, $studentId, $periodId) {
            $prediction = RiskPrediction::query()->create([
                'student_id' => $studentId,
                'academic_period_id' => $periodId,
                'risk_level' => $result['risk_level'] ?? null,
                'risk_score' => $result['risk_score'] ?? null,
                'factors' => $result['factors'] ?? [],
                'data_coverage' => $result['data_coverage'] ?? null,
                'insufficient_data' => (bool) ($result['insufficient_data'] ?? false),
                'needs_human_review' => (bool) ($result['needs_human_review'] ?? false),
                'recommendation' => $result['recommendation'] ?? null,
                'model_version' => $result['model_version'] ?? null,
                'predicted_at' => now(),
            ]);

            $this->storeDiagnostic(AiDiagnostic::TYPE_STUDENT_PROFILE, [
                'student_id' => $studentId,
                'academic_period_id' => $periodId,
            ], [
                'profile_cluster' => $result['profile_cluster'] ?? null,
                'data_coverage' => $result['data_coverage'] ?? null,
                'model_version' => $result['model_version'] ?? null,
                'insufficient_data' => $result['insufficient_data'] ?? false,
            ]);

            return $prediction;
        });

        RiskEvaluated::dispatch($prediction);

        return $prediction;
    }

    public function refreshClassroomRiskOnce(int $classroomId, int $periodId): void
    {
        $lockKey = "risk-refresh:{$periodId}:{$classroomId}";

        if (! Cache::add($lockKey, 1, now()->addMinutes(2))) {
            return;
        }

        try {
            $freshExists = RiskPrediction::query()
                ->where('academic_period_id', $periodId)
                ->where('predicted_at', '>', now()->subHours(self::RISK_TTL_HOURS))
                ->whereHas('student', fn ($query) => $query->where('classroom_id', $classroomId))
                ->exists();

            if ($freshExists) {
                return;
            }

            $batch = $this->client->batchRisk($periodId, $classroomId);

            if (! $batch['available']) {
                return;
            }

            foreach ($batch['results'] ?? [] as $result) {
                $this->storeRisk($result, $periodId);
            }
        } finally {
            Cache::forget($lockKey);
        }
    }

    private function isFresh(?RiskPrediction $prediction): bool
    {
        return $prediction !== null && $prediction->predicted_at?->gt(now()->subHours(self::RISK_TTL_HOURS));
    }

    private function storeDiagnostic(string $type, array $keys, array $payload): AiDiagnostic
    {
        unset($payload['available']);

        return AiDiagnostic::query()->updateOrCreate(['type' => $type] + $keys, [
            'payload' => $payload,
            'model_version' => $payload['model_version'] ?? null,
            'insufficient_data' => (bool) ($payload['insufficient_data'] ?? false),
            'generated_at' => now(),
        ]);
    }

    private function insightResponse(AiDiagnostic $diagnostic, bool $available, bool $stale): array
    {
        return [
            'available' => $available,
            'stale' => $stale,
            'generated_at' => $diagnostic->generated_at->toIso8601String(),
            'data' => $diagnostic->payload,
        ];
    }
}
