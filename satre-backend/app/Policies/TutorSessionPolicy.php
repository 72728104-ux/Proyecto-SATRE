<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\TutorSession;
use App\Models\User;
use App\Support\Roles;

/**
 * §1 "IA Tutor socrático": solo el estudiante, en cursos donde está matriculado y sobre sus sesiones.
 */
class TutorSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::STUDENT);
    }

    public function create(User $user, Course $course): bool
    {
        return $user->hasRole(Roles::STUDENT)
            && $user->student !== null
            && $course->enrollments()->where('student_id', $user->student->id)->where('status', 'active')->exists();
    }

    public function update(User $user, TutorSession $session): bool
    {
        return $user->hasRole(Roles::STUDENT)
            && $user->student !== null
            && $user->student->id === $session->student_id;
    }
}
