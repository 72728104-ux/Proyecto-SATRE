<?php

namespace App\Listeners;

use App\Events\AlertCreated;
use App\Events\RiskEvaluated;
use App\Models\Alert;
use App\Models\RiskPrediction;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * §4.7: crea una Alert solo si el nivel es ALTO y no hay otra abierta del estudiante;
 * si la abierta tenía un nivel menor (p. ej. MEDIO), la escala en vez de duplicar.
 */
class CreateAlertsFromRisk
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function handle(RiskEvaluated $event): void
    {
        $prediction = $event->prediction;

        if ($prediction->risk_level !== RiskPrediction::LEVEL_HIGH) {
            return;
        }

        $created = DB::transaction(function () use ($prediction) {
            $alert = Alert::query()
                ->open()
                ->where('student_id', $prediction->student_id)
                ->where('type', Alert::TYPE_RISK)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if ($alert === null) {
                $alert = Alert::query()->create([
                    'student_id' => $prediction->student_id,
                    'risk_prediction_id' => $prediction->id,
                    'type' => Alert::TYPE_RISK,
                    'severity' => RiskPrediction::LEVEL_HIGH,
                    'status' => 'open',
                    'title' => $this->title($prediction),
                    'message' => $this->message($prediction),
                ]);

                $this->auditLogger->record(null, 'alert.created_from_risk', $alert, [], $alert->only(['severity', 'status', 'risk_prediction_id']));

                return $alert;
            }

            $old = $alert->only(['severity', 'risk_prediction_id']);
            $escalating = $alert->severity !== RiskPrediction::LEVEL_HIGH;

            $alert->fill(['risk_prediction_id' => $prediction->id]);

            if ($escalating) {
                $alert->fill([
                    'severity' => RiskPrediction::LEVEL_HIGH,
                    'title' => $this->title($prediction),
                    'message' => $this->message($prediction),
                ]);
            }

            $alert->save();

            $this->auditLogger->record(null, $escalating ? 'alert.escalated' : 'alert.risk_refreshed', $alert, $old, $alert->only(['severity', 'risk_prediction_id']));

            return null;
        });

        if ($created !== null) {
            AlertCreated::dispatch($created);
        }
    }

    private function title(RiskPrediction $prediction): string
    {
        return $prediction->needs_human_review
            ? 'Riesgo ALTO · requiere revisión humana'
            : 'Riesgo ALTO de deserción';
    }

    private function message(RiskPrediction $prediction): string
    {
        return (string) ($prediction->recommendation ?: 'El estudiante alcanzó nivel de riesgo ALTO.');
    }
}
