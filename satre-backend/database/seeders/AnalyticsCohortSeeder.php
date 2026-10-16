<?php

namespace Database\Seeders;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Role;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Roles;
use Faker\Generator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Cohorte 4to B para probar el motor de riesgo (§5.3) y los insights por criterio.
 * No altera 5to A: los estudiantes llevan código ANL-001…ANL-030.
 */
class DemoAnalyticsSeeder extends Seeder
{
    private const PASSWORD = 'coar2026';

    private const TEACHER_EMAIL = 'tutor.4b@coar.edu.pe';

    private const ADMIN_EMAIL = 'admin@coar.edu.pe';

    private const SESSIONS_PER_COURSE = 8;

    private const NIGHT_CHECKS = 12;

    /** @var list<array{code: string, name: string, weekday: int}> */
    private const COURSES = [
        ['code' => 'MAT-4B', 'name' => 'Matemáticas: Análisis y enfoques', 'weekday' => 2],
        ['code' => 'BIO-4B', 'name' => 'Biología', 'weekday' => 4],
        ['code' => 'LEN-4B', 'name' => 'Lengua y Literatura', 'weekday' => 5],
    ];

    /** @var array<string, string> */
    private const CRITERION_LABELS = [
        'A' => 'indagación',
        'B' => 'análisis',
        'C' => 'comunicación',
        'D' => 'aplicación',
    ];

    public function run(): void
    {
        $period = AcademicPeriod::query()->where('is_current', true)->orderByDesc('id')->first();
        if ($period === null) {
            $this->command?->warn('DemoAnalyticsSeeder: no hay periodo académico actual. Se omite la cohorte.');

            return;
        }

        $summary = DB::transaction(fn () => $this->seedCohort($period, fake('es_PE')));
        $this->report($summary);
    }

    /**
     * @return array<string, mixed>
     */
    private function seedCohort(AcademicPeriod $period, Generator $faker): array
    {
        $this->purgeDemoCohort();

        $asOf = $this->asOf($period);
        if ($period->start_date->copy()->startOfDay()->gt($asOf->copy()->subDays(7))) {
            throw new RuntimeException('El periodo actual es demasiado corto para ubicar la incidencia grave de los últimos 7 días.');
        }

        $teacher = $this->teacher();
        $reporterId = User::query()->where('email', 'residencia@coar.edu.pe')->value('id') ?? $teacher->user_id;
        $classroom = Classroom::query()->updateOrCreate(
            ['name' => '4to B', 'academic_period_id' => $period->id],
            ['grade_level' => '4to', 'capacity' => 30, 'tutor_id' => $teacher->id]
        );
        if (Schema::hasTable('ai_diagnostics')) {
            DB::table('ai_diagnostics')->where('classroom_id', $classroom->id)->delete();
        }

        $courses = $this->courses($period, $classroom, $teacher);
        $weekdays = $this->datesBetween($period->start_date, $asOf, null);
        $classDates = [];
        foreach (self::COURSES as $index => $blueprint) {
            $classDates[$index] = $this->datesBetween($period->start_date, $asOf, $blueprint['weekday']);
        }
        $nightDates = $this->datesBetween($period->start_date, $asOf, 3);

        $now = now()->toDateTimeString();
        $attendanceRows = [];
        $gradeRows = [];
        $nightRows = [];
        $incidentRows = [];
        $counts = ['BAJO' => 0, 'MEDIO' => 0, 'ALTO' => 0, 'INSUFICIENTE' => 0];
        $grave = [];
        $sparse = [];

        foreach ($this->cohortPlan() as $position => $slot) {
            $number = $position + 1;
            $code = sprintf('ANL-%03d', $number);
            $profile = $slot['profile'];
            $ordinal = $slot['ordinal'];

            $studentId = DB::table('students')->insertGetId([
                'user_id' => null,
                'student_code' => $code,
                'document_number' => sprintf('82%06d', $number),
                'first_name' => $faker->firstName(),
                'last_name' => $faker->lastName().' '.$faker->lastName(),
                'status' => 'active',
                'is_boarder' => true,
                'classroom_id' => $classroom->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($courses as $course) {
                DB::table('enrollments')->insert([
                    'student_id' => $studentId,
                    'course_id' => $course->id,
                    'status' => 'active',
                    'enrolled_at' => $period->start_date->copy()->setTime(8, 0)->toDateTimeString(),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $counts[$profile]++;

            if ($profile === 'INSUFICIENTE') {
                $sparse[] = $code;
                $this->appendSparse(
                    $studentId,
                    $ordinal,
                    $courses,
                    $classDates,
                    $weekdays,
                    $teacher->user_id,
                    $period->id,
                    $now,
                    $attendanceRows,
                    $gradeRows,
                );

                continue;
            }

            $this->appendAttendance(
                $studentId,
                $profile,
                $ordinal,
                $courses,
                $classDates,
                $teacher->user_id,
                $period->id,
                $now,
                $faker,
                $attendanceRows,
            );
            $this->appendGrades(
                $studentId,
                $profile,
                $ordinal,
                $courses,
                $weekdays,
                $teacher->user_id,
                $period->id,
                $now,
                $faker,
                $gradeRows,
            );
            $this->appendNights(
                $studentId,
                $profile,
                $ordinal,
                $nightDates,
                $reporterId,
                $now,
                $faker,
                $nightRows,
            );

            foreach ($this->incidentPlan($profile, $ordinal) as $incident) {
                $at = $asOf->copy()->subDays($incident['days_before'])->setTime(
                    $faker->numberBetween(8, 20),
                    $faker->numberBetween(0, 59)
                );
                $incidentRows[] = [
                    'student_id' => $studentId,
                    'reported_by' => $reporterId,
                    'incident_at' => $at->toDateTimeString(),
                    'category' => $incident['category'],
                    'severity' => $incident['severity'],
                    'description' => $incident['description'],
                    'status' => $incident['severity'] === 'grave' ? 'open' : 'resolved',
                    'resolved_at' => $incident['severity'] === 'grave' ? null : $at->copy()->addDay()->toDateTimeString(),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                if ($incident['severity'] === 'grave') {
                    $grave[] = $code.' · '.$incident['category'].' grave · '.$at->toDateString();
                }
            }
        }

        $this->insertRows('attendances', $attendanceRows);
        $this->insertRows('grades', $gradeRows);
        $this->insertRows('residential_presences', $nightRows);
        $this->insertRows('incidents', $incidentRows);

        return [
            'classroom_id' => $classroom->id,
            'classroom' => $classroom->name,
            'period_id' => $period->id,
            'period' => $period->name,
            'as_of' => $asOf->toDateString(),
            'courses' => collect($courses)->map(fn (Course $course) => $course->code.' '.$course->name)->all(),
            'counts' => $counts,
            'grave' => $grave,
            'sparse' => $sparse,
            'teacher_email' => self::TEACHER_EMAIL,
            'teacher_name' => $teacher->user->name,
        ];
    }

    /**
     * @return list<array{profile: string, ordinal: int}>
     */
    private function cohortPlan(): array
    {
        $plan = [];
        foreach (['BAJO' => 10, 'MEDIO' => 9, 'ALTO' => 7, 'INSUFICIENTE' => 4] as $profile => $count) {
            for ($ordinal = 0; $ordinal < $count; $ordinal++) {
                $plan[] = ['profile' => $profile, 'ordinal' => $ordinal];
            }
        }

        return $plan;
    }

    private function teacher(): Teacher
    {
        $roleId = Role::query()->where('slug', Roles::TEACHER)->value('id');
        if ($roleId === null) {
            throw new RuntimeException('No existe el rol teacher. Ejecuta RoleSeeder primero.');
        }

        $user = User::query()->updateOrCreate(
            ['email' => self::TEACHER_EMAIL],
            [
                'name' => 'Ana Flores Cárdenas',
                'role_id' => $roleId,
                'password' => self::PASSWORD,
                'must_change_password' => false,
                'password_changed_at' => now(),
                'is_active' => true,
            ]
        );

        return Teacher::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['employee_code' => 'DOC-4B01', 'specialty' => 'Ciencias IB']
        );
    }

    /**
     * @return list<Course>
     */
    private function courses(AcademicPeriod $period, Classroom $classroom, Teacher $teacher): array
    {
        $courses = [];
        foreach (self::COURSES as $blueprint) {
            $courses[] = Course::query()->updateOrCreate(
                ['code' => $blueprint['code'], 'academic_period_id' => $period->id],
                [
                    'name' => $blueprint['name'],
                    'classroom_id' => $classroom->id,
                    'teacher_id' => $teacher->id,
                ]
            );
        }

        return $courses;
    }

    /**
     * Misma fecha de corte que el motor: hoy, o el fin del periodo si ya terminó.
     */
    private function asOf(AcademicPeriod $period): Carbon
    {
        $today = now()->startOfDay();
        $end = $period->end_date->copy()->startOfDay();

        return $today->lt($end) ? $today->copy() : $end;
    }

    /**
     * @return list<string>
     */
    private function datesBetween(Carbon $start, Carbon $end, ?int $isoWeekday): array
    {
        $dates = [];
        for ($day = $start->copy()->startOfDay(); $day->lte($end); $day->addDay()) {
            if ($day->isWeekend()) {
                continue;
            }
            if ($isoWeekday !== null && (int) $day->dayOfWeekIso !== $isoWeekday) {
                continue;
            }
            $dates[] = $day->toDateString();
        }

        return $dates;
    }

    /**
     * @param  list<string>  $dates
     * @return list<string>
     */
    private function pickDates(array $dates, int $count, int $offset): array
    {
        $total = count($dates);
        if ($total < $count) {
            throw new RuntimeException('El periodo académico actual no tiene suficientes días hábiles para la cohorte de analítica.');
        }

        $offset = $offset % $total;
        $rotated = array_merge(array_slice($dates, $offset), array_slice($dates, 0, $offset));
        $step = $total / $count;
        $picked = [];
        for ($i = 0; $i < $count; $i++) {
            $picked[] = $rotated[min($total - 1, (int) floor($i * $step))];
        }
        sort($picked);
        if (count(array_unique($picked)) !== $count) {
            throw new RuntimeException('No se pudieron elegir fechas distintas dentro del periodo académico actual.');
        }

        return $picked;
    }

    /**
     * @param  list<Course>  $courses
     * @param  array<int, list<string>>  $classDates
     * @param  list<array<string, mixed>>  $rows
     */
    private function appendAttendance(
        int $studentId,
        string $profile,
        int $ordinal,
        array $courses,
        array $classDates,
        int $recorderId,
        int $periodId,
        string $now,
        Generator $faker,
        array &$rows,
    ): void {
        $mix = match ($profile) {
            'BAJO' => ['unexcused' => $ordinal % 2, 'late' => intdiv($ordinal, 2) % 2],
            'MEDIO' => ['unexcused' => 4, 'late' => 1 + ($ordinal % 2)],
            default => ['unexcused' => 7 + ($ordinal % 2), 'late' => 2],
        };
        $unexcusedQuota = $this->quota($mix['unexcused'], count($courses), $ordinal);
        $lateQuota = $this->quota($mix['late'], count($courses), $ordinal + 1);

        foreach ($courses as $index => $course) {
            $dates = $this->pickDates($classDates[$index], self::SESSIONS_PER_COURSE, $ordinal + $index);
            $statuses = $this->mixStatuses(self::SESSIONS_PER_COURSE, [
                'absent_unjustified' => $unexcusedQuota[$index],
                'late' => $lateQuota[$index],
            ], 'present', $faker);

            foreach ($dates as $dateIndex => $date) {
                $status = $statuses[$dateIndex];
                $rows[] = [
                    'student_id' => $studentId,
                    'course_id' => $course->id,
                    'academic_period_id' => $periodId,
                    'attendance_date' => $date,
                    'status' => $status,
                    'recorded_by' => $recorderId,
                    'notes' => $this->attendanceNote($status, $faker),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }
    }

    /**
     * @param  list<Course>  $courses
     * @param  list<string>  $weekdays
     * @param  list<array<string, mixed>>  $rows
     */
    private function appendGrades(
        int $studentId,
        string $profile,
        int $ordinal,
        array $courses,
        array $weekdays,
        int $recorderId,
        int $periodId,
        string $now,
        Generator $faker,
        array &$rows,
    ): void {
        $specs = $this->gradeSpecs($profile, $ordinal);
        if ($profile !== 'ALTO') {
            $specs = $this->permute($specs, $faker);
        }
        $dates = $this->pickDates($weekdays, count($specs), $ordinal * 3);
        foreach ($specs as $index => $spec) {
            $recordedAt = Carbon::parse($dates[$index])->setTime(15, ($ordinal + $index) % 60);
            $rows[] = [
                'student_id' => $studentId,
                'course_id' => $courses[$spec['course']]->id,
                'academic_period_id' => $periodId,
                'evaluation_name' => 'Criterio '.$spec['criterion'].' · '.self::CRITERION_LABELS[$spec['criterion']].' '.$spec['round'],
                'criterion' => $spec['criterion'],
                'evaluation_date' => $dates[$index],
                'score' => $spec['score'],
                'max_score' => 7,
                'recorded_by' => $recorderId,
                'recorded_at' => $recordedAt->toDateTimeString(),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
    }

    /**
     * @return list<array{course: int, criterion: string, round: int, score: int}>
     */
    private function gradeSpecs(string $profile, int $ordinal): array
    {
        $lead = $ordinal % 2 === 1 ? [4, 4] : [5, 3];
        $matrix = match ($profile) {
            'BAJO' => $this->bajoMatrix($ordinal),
            // Una sola brecha por curso (promedio < 4): C en MAT, D en BIO, B en LEN.
            'MEDIO' => [
                0 => ['A' => $lead, 'B' => [4, 4], 'C' => [3, 3], 'D' => [4, 4]],
                1 => ['A' => $lead, 'B' => [4, 4], 'C' => [4, 4], 'D' => [3, 3]],
                2 => ['A' => $lead, 'B' => [3, 3], 'C' => [4, 4], 'D' => [4, 4]],
            ],
            default => [
                0 => ['A' => [4, 3], 'B' => [3, 2], 'C' => [2, 1], 'D' => [3, 2]],
                1 => ['A' => [4, 3], 'B' => [3, 2], 'C' => [3, 2], 'D' => [2, 1]],
                2 => ['A' => [4, 3], 'B' => [2, 1], 'C' => [3, 2], 'D' => [3, 2]],
            ],
        };

        $specs = [];
        foreach ($matrix as $courseIndex => $criteria) {
            foreach ($criteria as $criterion => $rounds) {
                foreach ($rounds as $roundIndex => $score) {
                    $specs[] = [
                        'course' => $courseIndex,
                        'criterion' => $criterion,
                        'round' => $roundIndex + 1,
                        'score' => $score,
                    ];
                }
            }
        }

        if ($profile !== 'ALTO') {
            return $specs;
        }

        $missingCourse = $ordinal % 3;
        $missingCriterion = ['A', 'B', 'C', 'D'][$ordinal % 4];
        $nudged = false;
        $filtered = [];
        foreach ($specs as $spec) {
            if ($spec['course'] === $missingCourse && $spec['criterion'] === $missingCriterion) {
                continue;
            }
            if (! $nudged && $ordinal % 2 === 1 && $spec['score'] === 3) {
                $spec['score'] = 2;
                $nudged = true;
            }
            $filtered[] = $spec;
        }

        usort($filtered, function (array $a, array $b): int {
            return $b['score'] <=> $a['score']
                ?: $a['course'] <=> $b['course']
                ?: strcmp($a['criterion'], $b['criterion']);
        });

        return $filtered;
    }

    /**
     * @return array<int, array<string, array{0: int, 1: int}>>
     */
    private function bajoMatrix(int $ordinal): array
    {
        $patterns = [
            ['A' => [6, 7], 'B' => [6, 6], 'C' => [7, 6], 'D' => [5, 6]],
            ['A' => [7, 6], 'B' => [5, 6], 'C' => [6, 7], 'D' => [6, 6]],
            ['A' => [6, 6], 'B' => [7, 5], 'C' => [6, 6], 'D' => [7, 6]],
        ];

        return [
            0 => $patterns[$ordinal % 3],
            1 => $patterns[($ordinal + 1) % 3],
            2 => $patterns[($ordinal + 2) % 3],
        ];
    }

    /**
     * @param  list<string>  $nightDates
     * @param  list<array<string, mixed>>  $rows
     */
    private function appendNights(
        int $studentId,
        string $profile,
        int $ordinal,
        array $nightDates,
        int $recorderId,
        string $now,
        Generator $faker,
        array &$rows,
    ): void {
        $absences = match ($profile) {
            'BAJO' => $ordinal % 2,
            'MEDIO' => 2 + ($ordinal % 2),
            default => 3 + ($ordinal % 2),
        };
        $dates = $this->pickDates($nightDates, self::NIGHT_CHECKS, $ordinal);
        $statuses = $this->mixStatuses(self::NIGHT_CHECKS, ['absent' => $absences], 'present', $faker);

        foreach ($dates as $index => $date) {
            $rows[] = [
                'student_id' => $studentId,
                'presence_date' => $date,
                'check_type' => 'night',
                'status' => $statuses[$index],
                'recorded_by' => $recorderId,
                'notes' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
    }

    /**
     * @return list<array{category: string, severity: string, days_before: int, description: string}>
     */
    private function incidentPlan(string $profile, int $ordinal): array
    {
        if ($profile === 'MEDIO') {
            if ($ordinal % 2 !== 0) {
                return [];
            }

            return [[
                'category' => $ordinal % 4 === 0 ? 'convivencia' : 'conducta',
                'severity' => 'leve',
                'days_before' => 12 + $ordinal,
                'description' => $ordinal % 4 === 0
                    ? 'Discusión breve en el comedor; se dialogó y quedó cerrada.'
                    : 'No respetó el horario de silencio de la residencia.',
            ]];
        }

        if ($profile !== 'ALTO') {
            return [];
        }

        $leve = [
            'category' => 'conducta',
            'severity' => 'leve',
            'days_before' => 14 + $ordinal,
            'description' => 'Llegó tarde a la formación de la residencia sin aviso previo.',
        ];
        $moderada = [
            'category' => 'convivencia',
            'severity' => 'moderada',
            'days_before' => 18 + ($ordinal % 3),
            'description' => 'Conflicto reiterado con un compañero de habitación; se medió en residencia.',
        ];

        return match ($ordinal) {
            0 => [
                [
                    'category' => 'salud',
                    'severity' => 'grave',
                    'days_before' => 2,
                    'description' => 'Malestar físico persistente en la residencia; se derivó a tópico y se avisó al tutor.',
                ],
                $leve,
            ],
            1 => [[
                'category' => 'emocional',
                'severity' => 'grave',
                'days_before' => 4,
                'description' => 'Episodio de ansiedad durante la noche; se solicitó acompañamiento de psicología.',
            ]],
            2 => [$moderada, $leve],
            3 => [$leve],
            4 => [$leve, [
                'category' => 'convivencia',
                'severity' => 'leve',
                'days_before' => 22,
                'description' => 'Discusión en el pasillo de residencia; ambos estudiantes fueron escuchados.',
            ]],
            5 => [$moderada],
            default => [[
                'category' => 'conducta',
                'severity' => 'leve',
                'days_before' => 11,
                'description' => 'Usó el celular durante la clase después de una advertencia.',
            ]],
        };
    }

    /**
     * @param  list<Course>  $courses
     * @param  array<int, list<string>>  $classDates
     * @param  list<string>  $weekdays
     * @param  list<array<string, mixed>>  $attendanceRows
     * @param  list<array<string, mixed>>  $gradeRows
     */
    private function appendSparse(
        int $studentId,
        int $ordinal,
        array $courses,
        array $classDates,
        array $weekdays,
        int $recorderId,
        int $periodId,
        string $now,
        array &$attendanceRows,
        array &$gradeRows,
    ): void {
        $attendance = match ($ordinal) {
            0 => [[0, 'present'], [0, 'present'], [0, 'present'], [1, 'late']],
            1 => [[1, 'present'], [1, 'present'], [2, 'absent_unjustified']],
            2 => [[2, 'present'], [0, 'late']],
            default => [[0, 'present'], [1, 'present'], [2, 'late'], [2, 'absent_unjustified']],
        };
        $grades = match ($ordinal) {
            0 => [[0, 'A', 6], [0, 'B', 5]],
            1 => [[1, 'C', 4]],
            2 => [[2, 'A', 3], [2, 'D', 2]],
            default => [[0, 'D', 1]],
        };

        $grouped = [];
        foreach ($attendance as [$courseIndex, $status]) {
            $grouped[$courseIndex][] = $status;
        }
        foreach ($grouped as $courseIndex => $statuses) {
            $dates = $this->pickDates($classDates[$courseIndex], count($statuses), $ordinal + 5);
            foreach ($statuses as $index => $status) {
                $attendanceRows[] = [
                    'student_id' => $studentId,
                    'course_id' => $courses[$courseIndex]->id,
                    'academic_period_id' => $periodId,
                    'attendance_date' => $dates[$index],
                    'status' => $status,
                    'recorded_by' => $recorderId,
                    'notes' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        $gradeDates = $this->pickDates($weekdays, count($grades), $ordinal + 9);
        foreach ($grades as $index => [$courseIndex, $criterion, $score]) {
            $gradeRows[] = [
                'student_id' => $studentId,
                'course_id' => $courses[$courseIndex]->id,
                'academic_period_id' => $periodId,
                'evaluation_name' => 'Criterio '.$criterion.' · registro parcial',
                'criterion' => $criterion,
                'evaluation_date' => $gradeDates[$index],
                'score' => $score,
                'max_score' => 7,
                'recorded_by' => $recorderId,
                'recorded_at' => Carbon::parse($gradeDates[$index])->setTime(11, 15)->toDateTimeString(),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
    }

    private function attendanceNote(string $status, Generator $faker): ?string
    {
        if (! in_array($status, ['late', 'absent_unjustified'], true) || ! $faker->boolean(35)) {
            return null;
        }

        return $faker->randomElement([
            'Llegó cerca de 15 minutos después del inicio.',
            'No presentó justificación en secretaría.',
            'Avisó a residencia, pero no alcanzó a entrar a clase.',
            'Se retiró antes de terminar la sesión.',
        ]);
    }

    /**
     * @param  array<string, int>  $counts
     * @return list<string>
     */
    private function mixStatuses(int $size, array $counts, string $rest, Generator $faker): array
    {
        $list = [];
        $used = 0;
        foreach ($counts as $status => $count) {
            if ($count > 0) {
                $list = array_merge($list, array_fill(0, $count, $status));
                $used += $count;
            }
        }
        if ($used > $size) {
            throw new RuntimeException('La mezcla de estados no cabe en las sesiones generadas.');
        }
        if ($size - $used > 0) {
            $list = array_merge($list, array_fill(0, $size - $used, $rest));
        }

        return $this->permute($list, $faker);
    }

    /**
     * @return list<int>
     */
    private function quota(int $total, int $buckets, int $shift): array
    {
        $parts = array_fill(0, $buckets, intdiv($total, $buckets));
        for ($i = 0; $i < $total % $buckets; $i++) {
            $parts[($shift + $i) % $buckets]++;
        }

        return $parts;
    }

    /**
     * @template T
     *
     * @param  list<T>  $items
     * @return list<T>
     */
    private function permute(array $items, Generator $faker): array
    {
        $items = array_values($items);
        for ($i = count($items) - 1; $i > 0; $i--) {
            $j = $faker->numberBetween(0, $i);
            [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
        }

        return $items;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function insertRows(string $table, array $rows): void
    {
        foreach (array_chunk($rows, 400) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }

    private function purgeDemoCohort(): void
    {
        $ids = DB::table('students')->where('student_code', 'like', 'ANL-%')->pluck('id');
        if ($ids->isEmpty()) {
            return;
        }

        if (Schema::hasTable('tutor_sessions')) {
            $sessionIds = DB::table('tutor_sessions')->whereIn('student_id', $ids)->pluck('id');
            if ($sessionIds->isNotEmpty() && Schema::hasTable('tutor_messages')) {
                DB::table('tutor_messages')->whereIn('tutor_session_id', $sessionIds)->delete();
            }
            DB::table('tutor_sessions')->whereIn('student_id', $ids)->delete();
        }

        foreach (['follow_ups', 'interventions', 'alerts'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->whereIn('student_id', $ids)->delete();
            }
        }

        if (Schema::hasTable('risk_predictions')) {
            $predictionIds = DB::table('risk_predictions')->whereIn('student_id', $ids)->pluck('id');
            if ($predictionIds->isNotEmpty() && Schema::hasTable('risk_explanations')) {
                DB::table('risk_explanations')->whereIn('risk_prediction_id', $predictionIds)->delete();
            }
            DB::table('risk_predictions')->whereIn('student_id', $ids)->delete();
        }

        foreach (['student_feature_snapshots', 'ai_diagnostics', 'permission_requests', 'attendances', 'grades', 'residential_presences', 'incidents', 'enrollments', 'guardian_student'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->whereIn('student_id', $ids)->delete();
            }
        }

        DB::table('students')->whereIn('id', $ids)->delete();
    }

    /**
     * @param  array<string, mixed>  $summary
     */
    private function report(array $summary): void
    {
        $admin = User::query()->where('email', self::ADMIN_EMAIL)->first();
        $counts = $summary['counts'];

        $lines = [
            'Cohorte analítica lista.',
            sprintf(
                'Aula %s (id %d) · periodo %s (id %d) · corte del motor %s',
                $summary['classroom'],
                $summary['classroom_id'],
                $summary['period'],
                $summary['period_id'],
                $summary['as_of']
            ),
            'Cursos: '.implode(' | ', $summary['courses']),
            sprintf(
                'Estudiantes: %d · BAJO %d · MEDIO %d · ALTO %d · datos insuficientes %d (%s)',
                array_sum($counts),
                $counts['BAJO'],
                $counts['MEDIO'],
                $counts['ALTO'],
                $counts['INSUFICIENTE'],
                implode(', ', $summary['sparse'])
            ),
            'Escalamiento (grave salud/emocional en los 7 días previos al corte):',
            ...array_map(fn (string $line) => '  '.$line, $summary['grave']),
            'Credenciales (contraseña '.self::PASSWORD.'):',
            sprintf('  Admin: %s (%s)', self::ADMIN_EMAIL, $admin?->name ?? 'DemoUserSeeder'),
            sprintf('  Docente del aula: %s (%s)', $summary['teacher_email'], $summary['teacher_name']),
        ];

        foreach ($lines as $line) {
            $this->command?->info($line);
        }
    }
}
