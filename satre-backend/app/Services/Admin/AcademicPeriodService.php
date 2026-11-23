<?php

namespace App\Services\Admin;

use App\Models\AcademicPeriod;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AcademicPeriodService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function create(User $admin, array $data): AcademicPeriod
    {
        $period = AcademicPeriod::query()->create($data + ['is_current' => false]);

        $this->auditLogger->record($admin, 'period.created', $period, [], $period->toArray());

        return $period;
    }

    public function update(User $admin, AcademicPeriod $period, array $data): AcademicPeriod
    {
        $old = $period->only(array_keys($data));
        $period->update($data);

        $this->auditLogger->record($admin, 'period.updated', $period, $old, $period->only(array_keys($data)));

        return $period;
    }

    public function delete(User $admin, AcademicPeriod $period): void
    {
        if ($period->is_current || $period->classrooms()->exists() || $period->courses()->exists()) {
            throw ValidationException::withMessages([
                'period' => 'Solo se puede eliminar un periodo no vigente y sin aulas ni cursos.',
            ]);
        }

        $this->auditLogger->record($admin, 'period.deleted', $period, $period->toArray(), []);
        $period->delete();
    }

    public function setCurrent(User $admin, AcademicPeriod $period): AcademicPeriod
    {
        return DB::transaction(function () use ($admin, $period) {
            $previousId = AcademicPeriod::query()->where('is_current', true)->value('id');

            AcademicPeriod::query()->whereKeyNot($period->id)->where('is_current', true)->update(['is_current' => false]);
            $period->forceFill(['is_current' => true])->save();

            $this->auditLogger->record($admin, 'period.set_current', $period,
                ['current_period_id' => $previousId],
                ['current_period_id' => $period->id],
            );

            return $period;
        });
    }
}
