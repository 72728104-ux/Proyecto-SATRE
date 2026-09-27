<?php

namespace App\Services;

use App\Models\ResidentialPresence;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ResidentialPresenceService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function record(User $recorder, array $data): ResidentialPresence
    {
        $alreadyRecorded = ResidentialPresence::query()
            ->where('student_id', $data['student_id'])
            ->whereDate('presence_date', $data['presence_date'])
            ->where('check_type', $data['check_type'])
            ->exists();

        if ($alreadyRecorded) {
            throw ValidationException::withMessages([
                'presence_date' => 'Ya existe un registro de presencia para este estudiante, fecha y control.',
            ]);
        }

        $presence = ResidentialPresence::query()->create([
            'student_id' => $data['student_id'],
            'presence_date' => $data['presence_date'],
            'check_type' => $data['check_type'],
            'status' => $data['status'],
            'recorded_by' => $recorder->id,
            'notes' => $data['notes'] ?? null,
        ]);

        $this->auditLogger->record($recorder, 'presence.recorded', $presence, [], $presence->toArray());

        return $presence->load('student');
    }

    /**
     * Checklist de un control: crea o actualiza la presencia de cada interno, todo o nada.
     *
     * @return EloquentCollection<int, ResidentialPresence>
     */
    public function recordBulk(User $recorder, array $data): EloquentCollection
    {
        $studentIds = collect($data['records'])->pluck('student_id');
        $boarderIds = Student::query()->whereIn('id', $studentIds)->where('is_boarder', true)->pluck('id');

        foreach ($data['records'] as $index => $record) {
            if (! $boarderIds->contains($record['student_id'])) {
                throw ValidationException::withMessages([
                    "records.$index.student_id" => 'El estudiante no es interno de la residencia.',
                ]);
            }
        }

        $date = Carbon::parse($data['presence_date'])->toDateString();

        $saved = DB::transaction(function () use ($recorder, $data, $studentIds, $date) {
            $existing = ResidentialPresence::query()
                ->whereIn('student_id', $studentIds)
                ->whereDate('presence_date', $date)
                ->where('check_type', $data['check_type'])
                ->get()
                ->keyBy('student_id');

            return collect($data['records'])->map(function (array $record) use ($recorder, $data, $date, $existing) {
                $values = ['status' => $record['status'], 'notes' => $record['notes'] ?? null];
                $presence = $existing->get($record['student_id']);

                if (! $presence) {
                    $presence = ResidentialPresence::query()->create($values + [
                        'student_id' => $record['student_id'],
                        'presence_date' => $date,
                        'check_type' => $data['check_type'],
                        'recorded_by' => $recorder->id,
                    ]);
                    $this->auditLogger->record($recorder, 'presence.recorded', $presence, [], $presence->toArray());

                    return $presence;
                }

                $presence->fill($values);
                if ($presence->isDirty()) {
                    $oldValues = array_intersect_key($presence->getRawOriginal(), $presence->getDirty());
                    $presence->save();
                    $this->auditLogger->record($recorder, 'presence.updated', $presence, $oldValues, Arr::except($presence->getChanges(), 'updated_at'));
                }

                return $presence;
            })->all();
        });

        return (new EloquentCollection($saved))->load('student');
    }

    public function update(User $recorder, ResidentialPresence $presence, array $data): ResidentialPresence
    {
        $presence->fill($data);
        $oldValues = array_intersect_key($presence->getRawOriginal(), $presence->getDirty());
        $presence->save();

        $this->auditLogger->record($recorder, 'presence.updated', $presence, $oldValues, Arr::except($presence->getChanges(), 'updated_at'));

        return $presence->load('student');
    }
}
