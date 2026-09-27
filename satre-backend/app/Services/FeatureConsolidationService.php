<?php

namespace App\Services;

use App\Events\StudentFeaturesUpdated;
use App\Models\AcademicPeriod;
use App\Models\Attendance;
use App\Models\Grade;
use App\Models\Incident;
use App\Models\ResidentialPresence;
use App\Models\Student;
use App\Models\StudentFeatureSnapshot;

class FeatureConsolidationService
{
    public function consolidate(Student $student, AcademicPeriod $period): StudentFeatureSnapshot
    {
        $attendances = Attendance::query()
            ->where('student_id', $student->id)
            ->where('academic_period_id', $period->id)
            ->get();

        $totalAttendances = $attendances->count();
        $attended = $attendances->whereIn('status', ['present', 'late', 'justified'])->count();
        $late = $attendances->where('status', 'late')->count();

        $presences = ResidentialPresence::query()
            ->where('student_id', $student->id)
            ->whereBetween('presence_date', [$period->start_date, $period->end_date])
            ->get();

        $grades = Grade::query()
            ->where('student_id', $student->id)
            ->where('academic_period_id', $period->id)
            ->get();

        $failedCourses = $grades
            ->groupBy('course_id')
            ->filter(function ($courseGrades) {
                $average = $courseGrades->avg('score');
                $max = $courseGrades->avg('max_score') ?: 20;

                return $max > 0 && ($average / $max) < 0.55;
            })
            ->count();

        $incidents = Incident::query()
            ->where('student_id', $student->id)
            ->whereBetween('incident_at', [$period->start_date, $period->end_date->copy()->endOfDay()])
            ->count();

        $snapshot = StudentFeatureSnapshot::query()->create([
            'student_id' => $student->id,
            'academic_period_id' => $period->id,
            'snapshot_at' => now(),
            'attendance_rate' => $totalAttendances > 0 ? round($attended / $totalAttendances, 4) : null,
            'residential_presence_rate' => $presences->count() > 0
                ? round($presences->where('status', 'present')->count() / $presences->count(), 4)
                : null,
            'academic_average' => $grades->count() > 0 ? round((float) $grades->avg('score'), 2) : null,
            'failed_courses' => $failedCourses,
            'academic_trend' => $this->academicTrend($student, $period),
            'incident_count' => $incidents,
            'tardiness_rate' => $totalAttendances > 0 ? round($late / $totalAttendances, 4) : null,
            'extra_features' => [
                'attendance_records' => $totalAttendances,
            ],
            'generated_by' => 'feature_consolidation',
        ]);

        StudentFeaturesUpdated::dispatch($snapshot);

        return $snapshot;
    }

    private function academicTrend(Student $student, AcademicPeriod $period): ?float
    {
        $previous = StudentFeatureSnapshot::query()
            ->where('student_id', $student->id)
            ->where('academic_period_id', $period->id)
            ->whereNotNull('academic_average')
            ->latest('snapshot_at')
            ->first();

        if ($previous === null || $previous->academic_average === null) {
            return 0;
        }

        $currentAverage = Grade::query()
            ->where('student_id', $student->id)
            ->where('academic_period_id', $period->id)
            ->avg('score');

        if ($currentAverage === null) {
            return 0;
        }

        return round(((float) $currentAverage - (float) $previous->academic_average) / 20, 4);
    }
}
