<?php

namespace App\Services\Admin;

use App\Models\AcademicPeriod;
use App\Models\Alert;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\User;

class AdminMetricsService
{
    public const COVERAGE_DAYS = 7;

    /**
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        return [
            'users' => $this->users(),
            'attendance_coverage' => $this->attendanceCoverage(),
            'alerts' => $this->openAlerts(),
        ];
    }

    /**
     * @return array{active: int, inactive: int, logged_in_last_30_days: int, active_by_role: array<string, int>}
     */
    private function users(): array
    {
        return [
            'active' => User::query()->where('is_active', true)->count(),
            'inactive' => User::query()->where('is_active', false)->count(),
            'logged_in_last_30_days' => User::query()->where('last_login_at', '>=', now()->subDays(30))->count(),
            'active_by_role' => User::query()
                ->join('roles', 'roles.id', '=', 'users.role_id')
                ->where('users.is_active', true)
                ->groupBy('roles.slug')
                ->selectRaw('roles.slug as slug, count(*) as total')
                ->pluck('total', 'slug')
                ->map(fn ($total) => (int) $total)
                ->all(),
        ];
    }

    /**
     * Cursos del periodo vigente con al menos un registro de asistencia en los últimos COVERAGE_DAYS días.
     *
     * @return array<string, mixed>
     */
    private function attendanceCoverage(): array
    {
        $period = AcademicPeriod::query()->where('is_current', true)->first();
        $from = today()->subDays(self::COVERAGE_DAYS - 1)->toDateString();
        $to = today()->toDateString();

        if ($period === null) {
            return [
                'academic_period_id' => null,
                'date_from' => $from,
                'date_to' => $to,
                'courses_total' => 0,
                'courses_with_attendance' => 0,
                'rate' => null,
                'insufficient_data' => true,
            ];
        }

        $coursesTotal = Course::query()->where('academic_period_id', $period->id)->count();
        $coursesWithAttendance = Attendance::query()
            ->where('academic_period_id', $period->id)
            ->whereDate('attendance_date', '>=', $from)
            ->whereDate('attendance_date', '<=', $to)
            ->distinct()
            ->count('course_id');

        return [
            'academic_period_id' => $period->id,
            'date_from' => $from,
            'date_to' => $to,
            'courses_total' => $coursesTotal,
            'courses_with_attendance' => $coursesWithAttendance,
            'rate' => $coursesTotal > 0 ? round($coursesWithAttendance / $coursesTotal, 4) : null,
            'insufficient_data' => $coursesTotal === 0,
        ];
    }

    /**
     * @return array{open: int, open_by_severity: array<string, int>}
     */
    private function openAlerts(): array
    {
        $bySeverity = Alert::query()
            ->where('status', 'open')
            ->groupBy('severity')
            ->selectRaw('severity, count(*) as total')
            ->pluck('total', 'severity')
            ->map(fn ($total) => (int) $total);

        return [
            'open' => $bySeverity->sum(),
            'open_by_severity' => $bySeverity->all(),
        ];
    }
}
