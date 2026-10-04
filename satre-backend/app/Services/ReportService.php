<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\RiskPrediction;
use App\Models\Student;
use App\Support\TextPdf;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;

class ReportService
{
    private const ATTENDED_STATUSES = ['present', 'late'];

    public function __construct(
        private readonly StudentSummaryService $studentSummary,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function studentPerformance(Student $student): array
    {
        return $this->studentSummary->build($student);
    }

    /**
     * Contrato del frontend: summary, risk_distribution y courses.
     *
     * @return array<string, mixed>
     */
    public function classroomAnalytics(Classroom $classroom): array
    {
        $report = $this->buildClassroomReport($classroom);

        return [
            'insufficient_data' => $report['insufficient_data'],
            'summary' => $report['summary'],
            'risk_distribution' => $report['risk_distribution'],
            'courses' => $report['courses'],
        ];
    }

    public function exportClassroom(Classroom $classroom, string $format): Response
    {
        $report = $this->buildClassroomReport($classroom);
        $filename = "reporte-aula-{$classroom->id}.{$format}";

        if ($format === 'csv') {
            $handle = fopen('php://temp', 'r+');
            fwrite($handle, "\xEF\xBB\xBF");
            foreach ($this->csvRows($report) as $row) {
                fputcsv($handle, $row);
            }
            rewind($handle);
            $csv = stream_get_contents($handle) ?: '';
            fclose($handle);

            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            ]);
        }

        return response(TextPdf::fromLines($this->pdfLines($report)), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildClassroomReport(Classroom $classroom): array
    {
        $classroom->load([
            'academicPeriod:id,name',
            'courses:id,classroom_id,name,code',
            'students:id,classroom_id,first_name,last_name,student_code',
        ]);

        $periodId = $classroom->academic_period_id;
        $studentIds = $classroom->students->pluck('id');
        $courseIds = $classroom->courses->pluck('id');

        $grades = $studentIds->isEmpty() || $courseIds->isEmpty()
            ? collect()
            : Grade::query()
                ->select(['id', 'student_id', 'course_id', 'score'])
                ->where('academic_period_id', $periodId)
                ->whereIn('student_id', $studentIds)
                ->whereIn('course_id', $courseIds)
                ->get();

        $attendances = $studentIds->isEmpty() || $courseIds->isEmpty()
            ? collect()
            : Attendance::query()
                ->select(['id', 'student_id', 'course_id', 'status'])
                ->where('academic_period_id', $periodId)
                ->whereIn('student_id', $studentIds)
                ->whereIn('course_id', $courseIds)
                ->get();

        $latestRisk = $studentIds->isEmpty()
            ? collect()
            : RiskPrediction::query()
                ->select(['id', 'student_id', 'risk_level', 'predicted_at'])
                ->where('academic_period_id', $periodId)
                ->whereIn('student_id', $studentIds)
                ->orderByDesc('predicted_at')
                ->orderByDesc('id')
                ->get()
                ->unique('student_id')
                ->keyBy('student_id');

        $openAlertsByStudent = $studentIds->isEmpty()
            ? collect()
            : Alert::query()
                ->select(['id', 'student_id'])
                ->whereIn('student_id', $studentIds)
                ->whereIn('status', Alert::OPEN_STATUSES)
                ->get()
                ->countBy('student_id');

        $studentRows = $classroom->students
            ->sortBy(fn (Student $student) => $student->last_name.' '.$student->first_name)
            ->values()
            ->map(function (Student $student) use ($grades, $attendances, $latestRisk, $openAlertsByStudent) {
                $studentGrades = $grades->where('student_id', $student->id);
                $studentAttendances = $attendances->where('student_id', $student->id);

                return [
                    'student_id' => $student->id,
                    'student_code' => $student->student_code,
                    'last_name' => $student->last_name,
                    'first_name' => $student->first_name,
                    'grade_mean' => $this->mean($studentGrades->pluck('score')),
                    'attendance_rate' => $this->attendanceRate($studentAttendances),
                    'risk_level' => $latestRisk->get($student->id)?->risk_level,
                    'open_alerts' => (int) ($openAlertsByStudent[$student->id] ?? $openAlertsByStudent[(string) $student->id] ?? 0),
                ];
            });

        $gradedMeans = $studentRows->pluck('grade_mean')->filter(fn ($value) => $value !== null);
        $insufficient = $grades->isEmpty() && $attendances->isEmpty();

        $riskDistribution = [
            RiskPrediction::LEVEL_HIGH => 0,
            RiskPrediction::LEVEL_MEDIUM => 0,
            RiskPrediction::LEVEL_LOW => 0,
        ];
        foreach ($latestRisk as $prediction) {
            if (isset($riskDistribution[$prediction->risk_level])) {
                $riskDistribution[$prediction->risk_level]++;
            }
        }

        $courses = $classroom->courses->map(function ($course) use ($grades, $attendances) {
            $courseGrades = $grades->where('course_id', $course->id);
            $means = $courseGrades->groupBy('student_id')->map(fn (Collection $group) => round((float) $group->avg('score'), 2));

            return [
                'course_id' => $course->id,
                'course_name' => $course->name,
                'grade_mean' => $this->mean($means),
                'pass_rate' => $this->passRate($means),
                'attendance_rate' => $this->attendanceRate($attendances->where('course_id', $course->id)),
            ];
        })->values()->all();

        return [
            'classroom' => [
                'id' => $classroom->id,
                'name' => $classroom->name,
                'period' => $classroom->academicPeriod?->name,
            ],
            'insufficient_data' => $insufficient,
            'summary' => [
                'students' => $studentRows->count(),
                'grade_mean' => $this->mean($gradedMeans),
                'pass_rate' => $this->passRate($gradedMeans),
                'attendance_rate' => $this->attendanceRate($attendances),
                'open_alerts' => $openAlertsByStudent->sum(),
            ],
            'risk_distribution' => $riskDistribution,
            'courses' => $courses,
            'students' => $studentRows->all(),
        ];
    }

    /**
     * @param  Collection<int, mixed>  $scores
     */
    private function mean(Collection $scores): ?float
    {
        return $scores->isEmpty() ? null : round((float) $scores->avg(), 2);
    }

    /**
     * @param  Collection<int, mixed>  $means
     */
    private function passRate(Collection $means): ?float
    {
        if ($means->isEmpty()) {
            return null;
        }

        return round($means->filter(fn ($mean) => $mean >= Grade::PASSING_SCORE)->count() / $means->count(), 4);
    }

    /**
     * @param  Collection<int, mixed>  $attendances
     */
    private function attendanceRate(Collection $attendances): ?float
    {
        $total = $attendances->count();
        if ($total === 0) {
            return null;
        }

        $attended = $attendances->whereIn('status', self::ATTENDED_STATUSES)->count();

        return round($attended / $total, 4);
    }

    /**
     * @param  array<string, mixed>  $report
     * @return list<list<string|int|float|null>>
     */
    private function csvRows(array $report): array
    {
        $summary = $report['summary'];
        $rows = [
            ['seccion', 'aula', 'periodo', 'estudiantes', 'promedio_ib', 'tasa_aprobados', 'tasa_asistencia', 'alertas_abiertas'],
            [
                'resumen',
                $report['classroom']['name'],
                $report['classroom']['period'],
                $summary['students'],
                $summary['grade_mean'],
                $summary['pass_rate'],
                $summary['attendance_rate'],
                $summary['open_alerts'],
            ],
            [],
            ['seccion', 'codigo', 'apellidos', 'nombres', 'promedio_ib', 'tasa_asistencia', 'riesgo', 'alertas_abiertas'],
        ];

        foreach ($report['students'] as $student) {
            $rows[] = [
                'estudiante',
                $student['student_code'],
                $student['last_name'],
                $student['first_name'],
                $student['grade_mean'],
                $student['attendance_rate'],
                $student['risk_level'],
                $student['open_alerts'],
            ];
        }

        $rows[] = [];
        $rows[] = ['seccion', 'curso_id', 'curso', 'promedio_ib', 'tasa_aprobados', 'tasa_asistencia'];
        foreach ($report['courses'] as $course) {
            $rows[] = [
                'curso',
                $course['course_id'],
                $course['course_name'],
                $course['grade_mean'],
                $course['pass_rate'],
                $course['attendance_rate'],
            ];
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $report
     * @return list<string>
     */
    private function pdfLines(array $report): array
    {
        $summary = $report['summary'];
        $risk = $report['risk_distribution'];
        $lines = [
            'SATRE · Reporte de grupo',
            'Aula: '.$report['classroom']['name'].' · Periodo: '.($report['classroom']['period'] ?? '—'),
            'Generado: '.now()->timezone('America/Lima')->format('Y-m-d H:i'),
            '',
            'Resumen',
            'Estudiantes: '.$summary['students'],
            'Promedio IB: '.$this->fmt($summary['grade_mean']),
            'Aprobados (>= 4): '.$this->pct($summary['pass_rate']),
            'Asistencia: '.$this->pct($summary['attendance_rate']),
            'Alertas abiertas: '.$summary['open_alerts'],
            '',
            'Distribucion de riesgo  ALTO: '.$risk['ALTO'].'  MEDIO: '.$risk['MEDIO'].'  BAJO: '.$risk['BAJO'],
            '',
            'Estudiantes',
            'Codigo | Apellidos, Nombres | Promedio IB | Asistencia | Riesgo | Alertas',
        ];

        foreach ($report['students'] as $student) {
            $lines[] = sprintf(
                '%s | %s, %s | %s | %s | %s | %d',
                $student['student_code'],
                $student['last_name'],
                $student['first_name'],
                $this->fmt($student['grade_mean']),
                $this->pct($student['attendance_rate']),
                $student['risk_level'] ?? '—',
                $student['open_alerts'],
            );
        }

        $lines[] = '';
        $lines[] = 'Cursos';
        $lines[] = 'Curso | Promedio IB | Aprobados | Asistencia';
        foreach ($report['courses'] as $course) {
            $lines[] = sprintf(
                '%s | %s | %s | %s',
                $course['course_name'],
                $this->fmt($course['grade_mean']),
                $this->pct($course['pass_rate']),
                $this->pct($course['attendance_rate']),
            );
        }

        return $lines;
    }

    private function fmt(?float $value): string
    {
        return $value === null ? '—' : number_format($value, 2, '.', '');
    }

    private function pct(?float $rate): string
    {
        return $rate === null ? '—' : number_format($rate * 100, 1, '.', '').'%';
    }
}
