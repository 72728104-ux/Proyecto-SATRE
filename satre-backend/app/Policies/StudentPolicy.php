<?php

namespace App\Policies;

use App\Models\Student;
use App\Models\User;
use App\Support\Roles;

class StudentPolicy
{
    public function viewSummary(User $user, Student $student): bool
    {
        if ($user->hasRole(Roles::STUDENT)) {
            return $user->student?->id === $student->id;
        }

        return $user->hasRole(Roles::GUARDIAN)
            && $user->guardian !== null
            && $user->guardian->students()->where('students.id', $student->id)->exists();
    }

    public function viewResidents(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::MONITOR);
    }

    /**
     * §1 "Alertas y riesgo": admin con acceso total, teacher su aula, monitor residencial, student propio, guardian hijos.
     */
    public function viewRisk(User $user, Student $student): bool
    {
        $canView = $user->hasRole(Roles::ADMIN);

        if (! $canView) {
            if ($user->hasRole(Roles::TEACHER)) {
                $teacherId = $user->teacher?->id;

                $canView = $teacherId !== null && (
                    $student->classroom()->where('tutor_id', $teacherId)->exists()
                    || $student->enrollments()
                        ->where('status', 'active')
                        ->whereHas('course', fn ($query) => $query->where('teacher_id', $teacherId))
                        ->exists()
                );
            } elseif ($user->hasRole(Roles::MONITOR)) {
                $canView = $student->is_boarder;
            } else {
                $canView = $this->viewSummary($user, $student);
            }
        }

        return $canView;
    }

    /**
     * Student y guardian solo ven nivel + recomendación.
     */
    public function viewRiskDetail(User $user, Student $student): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::MONITOR) && $this->viewRisk($user, $student);
    }

    /**
     * §1 Reportes: admin con acceso total, teacher su aula, student propio, guardian hijos.
     */
    public function viewPerformance(User $user, Student $student): bool
    {
        if ($user->hasRole(Roles::ADMIN, Roles::TEACHER)) {
            return $this->viewRisk($user, $student);
        }

        return $this->viewSummary($user, $student);
    }
}
