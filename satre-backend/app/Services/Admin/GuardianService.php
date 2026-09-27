<?php

namespace App\Services\Admin;

use App\Models\Guardian;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

class GuardianService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{student_id: int, relationship?: string|null, is_primary?: bool}  $data
     */
    public function linkStudent(User $admin, Guardian $guardian, array $data): Guardian
    {
        return DB::transaction(function () use ($admin, $guardian, $data) {
            $current = $guardian->students()->where('students.id', $data['student_id'])->first()?->pivot;

            $old = $current ? [
                'student_id' => $data['student_id'],
                'relationship' => $current->relationship,
                'is_primary' => (bool) $current->is_primary,
            ] : [];

            $pivot = [
                'relationship' => $data['relationship'] ?? $current?->relationship,
                'is_primary' => $data['is_primary'] ?? (bool) $current?->is_primary,
            ];

            if ($pivot['is_primary']) {
                DB::table('guardian_student')
                    ->where('student_id', $data['student_id'])
                    ->where('guardian_id', '!=', $guardian->id)
                    ->update(['is_primary' => false]);
            }

            $guardian->students()->syncWithoutDetaching([$data['student_id'] => $pivot]);

            $this->auditLogger->record($admin, 'guardian.student_linked', $guardian, $old, ['student_id' => $data['student_id']] + $pivot);

            return $guardian->load('students');
        });
    }
}
