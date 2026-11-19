<?php

namespace App\Policies\Concerns;

use App\Models\Enrollment;
use App\Models\ReadingMaterial;
use App\Models\User;
use App\Support\Roles;

/**
 * Reglas compartidas por las políticas que dependen de una lectura del curso:
 * personal administrativo/docente puede listar; el estudiante solo crea si
 * está matriculado en el curso de la lectura.
 */
trait AuthorizesReadingAccess
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::STUDENT);
    }

    public function create(User $user, ?ReadingMaterial $reading = null): bool
    {
        if (! $user->hasRole(Roles::STUDENT) || $user->student === null) {
            return false;
        }

        if ($reading === null) {
            return true;
        }

        return Enrollment::query()
            ->where('student_id', $user->student->id)
            ->where('course_id', $reading->course_id)
            ->where('status', 'active')
            ->exists();
    }
}
