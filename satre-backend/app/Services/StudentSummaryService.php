<?php

namespace App\Services;

use App\Models\AcademicPeriod;
use App\Models\Alert;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Grade;
use App\Models\ResidentialPresence;
use App\Models\Student;

class StudentSummaryService
{
    private const ATTENDED_STATUSES = ['present', 'late'];

    private const ACTIVE_ALERT_STATUSES = ['open', 'acknowledged'];

    /**
     * @return array<string, mixed>
     */
    public function build(Student $student): array
    {
        $student->loadMissing('classroom');
        $period = AcademicPeriod::query()->where('is_current', true)->first();

        return [
            'student' => [
                'id' => $student->id,
                'student_code' => $student->student_code,
                'name' => trim($student->first_name.' '.$student->last_name),
                'classroom' => $student->classroom?->name,
            ],
            'academic_period' => $period ? ['id' => $period->id, 'name' => $period->name] : null,
            'courses' => $this->courses($student, $period),
            'grades' => $this->grades($student, $period),
            'attendance' => $this->attendance($student, $period),
            'residence' => $this->residence($student, $period),
            'alerts' => $this->alerts($student),
        ];
    }

    /**
     * Cursos con matrícula activa en el periodo vigente (selector del tutor socrático y filtros).
     *
     * @return list<array{id: int, code: string, name: string}>
     */
    private function courses(Student $student, ?AcademicPeriod $period): array
    {
        return Course::query()
            ->whereHas('enrollments', fn ($query) => $query->where('student_id', $student->id)->where('status', 'active'))
            ->when($period, fn ($query) => $query->where('academic_period_id', $period->id))
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->map(fn (Course $course) => ['id' => $course->id, 'code' => $course->code, 'name' => $course->name])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function grades(Student $student, ?AcademicPeriod $period): array
    {
        $grades = Grade::query()
            ->with('course:id,name')
            ->where('student_id', $student->id)
            ->when($period, fn ($query) => $query->where('academic_period_id', $period->id))
            ->get();

        $byCourse = $grades->groupBy('course_id')->map(function ($courseGrades) {
            $average = round((float) $courseGrades->avg('score'), 2);

            return [
                'course_id' => $courseGrades->first()->course_id,
                'course_name' => $courseGrades->first()->course?->name,
                'average' => $average,
                'passing' => $average >= Grade::PASSING_SCORE,
                'count' => $courseGrades->count(),
                'criteria' => collect(Grade::CRITERIA)->mapWithKeys(function (string $criterion) use ($courseGrades) {
                    $scores = $courseGrades->where('criterion', $criterion);

                    return [$criterion => $scores->isEmpty() ? null : round((float) $scores->avg('score'), 2)];
                }),
            ];
        })->values();

        return [
            'average' => $grades->isEmpty() ? null : round((float) $grades->avg('score'), 2),
            'scale' => ['min' => Grade::MIN_SCORE, 'max' => Grade::MAX_SCORE, 'passing' => Grade::PASSING_SCORE],
            'failing_courses' => $byCourse->where('passing', false)->count(),
            'by_course' => $byCourse,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function attendance(Student $student, ?AcademicPeriod $period): array
    {
        $byStatus = Attendance::query()
            ->where('student_id', $student->id)
            ->when($period, fn ($query) => $query->where('academic_period_id', $period->id))
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($total) => (int) $total);

        $total = $byStatus->sum();
        $attended = $byStatus->only(self::ATTENDED_STATUSES)->sum();

        return [
            'total' => $total,
            'by_status' => $byStatus,
            'rate' => $total > 0 ? round($attended / $total, 4) : null,
        ];
    }

    /**
     * Internos: presente y con permiso cuentan como cubiertos. Externos: `null`.
     *
     * @return array<string, mixed>|null
     */
    private function residence(Student $student, ?AcademicPeriod $period): ?array
    {
        if (! $student->is_boarder) {
            return null;
        }

        $byStatus = ResidentialPresence::query()
            ->where('student_id', $student->id)
            ->when(
                $period,
                fn ($query) => $query->whereBetween('presence_date', [$period->start_date, $period->end_date])
            )
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($total) => (int) $total);

        $total = $byStatus->sum();
        $covered = $byStatus->only(['present', 'on_permission'])->sum();

        return [
            'total' => $total,
            'by_status' => $byStatus,
            'rate' => $total > 0 ? round($covered / $total, 4) : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function alerts(Student $student): array
    {
        $active = Alert::query()
            ->where('student_id', $student->id)
            ->whereIn('status', self::ACTIVE_ALERT_STATUSES)
            ->latest()
            ->get(['id', 'type', 'severity', 'title', 'status', 'created_at']);

        return [
            'open' => $active->count(),
            'items' => $active->take(5)->values(),
        ];
    }
}
