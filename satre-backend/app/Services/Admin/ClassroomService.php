<?php

namespace App\Services\Admin;

use App\Models\Classroom;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Validation\ValidationException;

class ClassroomService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function create(User $admin, array $data): Classroom
    {
        $classroom = Classroom::query()->create($data);

        $this->auditLogger->record($admin, 'classroom.created', $classroom, [], $classroom->toArray());

        return $classroom->load(['academicPeriod', 'tutor.user']);
    }

    public function update(User $admin, Classroom $classroom, array $data): Classroom
    {
        $old = $classroom->only(array_keys($data));
        $classroom->update($data);

        $this->auditLogger->record($admin, 'classroom.updated', $classroom, $old, $classroom->only(array_keys($data)));

        return $classroom->load(['academicPeriod', 'tutor.user']);
    }

    public function delete(User $admin, Classroom $classroom): void
    {
        if ($classroom->courses()->exists()) {
            throw ValidationException::withMessages([
                'classroom' => 'El aula tiene cursos asociados; reasígnalos o elimínalos primero.',
            ]);
        }

        $this->auditLogger->record($admin, 'classroom.deleted', $classroom, $classroom->toArray(), []);
        $classroom->delete();
    }
}
