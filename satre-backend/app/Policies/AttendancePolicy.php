<?php

namespace App\Policies;

use App\Models\Attendance;
use App\Models\Course;
use App\Models\User;
use App\Support\Roles;

class AttendancePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Roles::ADMIN, Roles::TEACHER, Roles::STUDENT);
    }

    public function create(User $user, ?Course $course = null): bool
    {
        if ($user->hasRole(Roles::ADMIN)) {
            return true;
        }

        if (! $user->hasRole(Roles::TEACHER) || $course === null) {
            return $user->hasRole(Roles::TEACHER);
        }

        return $user->teacher !== null && $user->teacher->id === $course->teacher_id;
    }

    public function view(User $user, Attendance $attendance): bool
    {
        if ($user->hasRole(Roles::ADMIN, Roles::TEACHER)) {
            return true;
        }

        if ($user->hasRole(Roles::STUDENT)) {
            return $user->student?->id === $attendance->student_id;
        }

        return false;
    }
}
