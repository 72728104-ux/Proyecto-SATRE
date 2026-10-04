<?php

namespace App\Services;

use App\Events\IncidentRecorded;
use App\Models\Incident;
use App\Models\User;
use Illuminate\Support\Arr;

class IncidentService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function record(User $reporter, array $data): Incident
    {
        $incident = Incident::query()->create([
            'student_id' => $data['student_id'],
            'reported_by' => $reporter->id,
            'incident_at' => $data['incident_at'],
            'category' => $data['category'],
            'severity' => $data['severity'],
            'description' => $data['description'],
            'status' => 'open',
        ]);

        $this->auditLogger->record($reporter, 'incident.recorded', $incident, [], $incident->toArray());

        IncidentRecorded::dispatch($incident); // D2: no consolidación ni jobs de riesgo en la petición.

        return $incident->load('student');
    }

    public function update(User $editor, Incident $incident, array $data): Incident
    {
        $incident->fill($data);

        if ($incident->isDirty('status')) {
            $incident->resolved_at = $incident->status === 'resolved' ? now() : null;
        }

        $oldValues = array_intersect_key($incident->getRawOriginal(), $incident->getDirty());
        $incident->save();

        $this->auditLogger->record($editor, 'incident.updated', $incident, $oldValues, Arr::except($incident->getChanges(), 'updated_at'));

        return $incident->load('student');
    }

    /**
     * §7: las lecturas de incidencias de salud quedan auditadas.
     *
     * @param  iterable<int, Incident>  $incidents
     */
    public function auditHealthReads(User $reader, iterable $incidents): void
    {
        foreach ($incidents as $incident) {
            if ($incident->category === 'salud') {
                $this->auditLogger->record($reader, 'incident.health_viewed', $incident, [], [
                    'category' => $incident->category,
                    'student_id' => $incident->student_id,
                ]);
            }
        }
    }
}
