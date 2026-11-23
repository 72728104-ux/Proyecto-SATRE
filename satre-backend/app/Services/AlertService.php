<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\FollowUp;
use App\Models\Intervention;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AlertService
{
    private const TRANSITIONS = [
        Alert::STATUS_OPEN => [Alert::STATUS_ACKNOWLEDGED, Alert::STATUS_RESOLVED],
        Alert::STATUS_ACKNOWLEDGED => [Alert::STATUS_RESOLVED],
        Alert::STATUS_RESOLVED => [],
    ];

    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function changeStatus(User $actor, Alert $alert, string $status): Alert
    {
        $allowed = self::TRANSITIONS[$alert->status] ?? [];

        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => $alert->status === Alert::STATUS_RESOLVED
                    ? 'Una alerta resuelta no puede cambiar de estado.'
                    : 'Transición de estado no permitida.',
            ]);
        }

        $old = $alert->only(['status']);
        $alert->update(['status' => $status]);

        $this->auditLogger->record($actor, 'alert.status_changed', $alert, $old, $alert->only(['status']));

        return $alert->load($this->eagerLoads());
    }

    public function createIntervention(User $actor, Alert $alert, array $data): Intervention
    {
        $intervention = Intervention::query()->create([
            'alert_id' => $alert->id,
            'student_id' => $alert->student_id,
            'assigned_to' => $actor->id,
            'type' => $data['type'],
            'description' => $data['description'],
            'status' => Intervention::STATUS_PLANNED,
            'started_at' => now(),
        ]);

        $this->auditLogger->record($actor, 'intervention.created', $intervention, [], $intervention->only(['type', 'status']));

        return $intervention->load('followUps');
    }

    public function createFollowUp(User $actor, Intervention $intervention, array $data): FollowUp
    {
        $followUp = FollowUp::query()->create([
            'intervention_id' => $intervention->id,
            'student_id' => $intervention->student_id,
            'recorded_by' => $actor->id,
            'follow_up_date' => $data['follow_up_date'],
            'outcome' => $data['outcome'] ?? null,
            'notes' => $data['notes'],
        ]);

        $this->auditLogger->record($actor, 'follow_up.created', $followUp, [], $followUp->only(['outcome', 'follow_up_date']));

        return $followUp;
    }

    /**
     * @return list<string>
     */
    public function eagerLoads(): array
    {
        return ['student:id,first_name,last_name', 'interventions.followUps'];
    }
}
