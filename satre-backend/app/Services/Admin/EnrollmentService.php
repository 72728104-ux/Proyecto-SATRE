<?php

namespace App\Services\Admin;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EnrollmentService
{
    public const ACTIVE = 'active';

    public const WITHDRAWN = 'withdrawn';

    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{student_id: int, course_id: int}  $data
     */
    public function enroll(User $admin, array $data): Enrollment
    {
        $enrollment = Enrollment::query()
            ->where('student_id', $data['student_id'])
            ->where('course_id', $data['course_id'])
            ->first();

        if ($enrollment?->status === self::ACTIVE) {
            throw ValidationException::withMessages([
                'student_id' => 'El estudiante ya está matriculado en el curso.',
            ]);
        }

        $this->saveActive($admin, $enrollment, $data['student_id'], $data['course_id'], 'enrollment.created');

        return Enrollment::query()
            ->with(['student', 'course'])
            ->where('student_id', $data['student_id'])
            ->where('course_id', $data['course_id'])
            ->firstOrFail();
    }

    /**
     * Valida todas las filas antes de escribir: si una falla, no se matricula ninguna.
     *
     * @return array{created: int, reactivated: int, skipped: int}
     */
    public function import(User $admin, UploadedFile $file, int $periodId): array
    {
        $rows = $this->readCsv($file);

        $students = Student::query()
            ->whereIn('student_code', array_column($rows, 'student_code'))
            ->pluck('id', 'student_code');
        $courses = Course::query()
            ->where('academic_period_id', $periodId)
            ->whereIn('code', array_column($rows, 'course_code'))
            ->pluck('id', 'code');

        $errors = [];
        $pairs = [];

        foreach ($rows as $line => $row) {
            $studentId = $students->get($row['student_code']);
            $courseId = $courses->get($row['course_code']);

            if ($studentId === null) {
                $errors["rows.$line"][] = "Estudiante {$row['student_code']} no existe.";
            }

            if ($courseId === null) {
                $errors["rows.$line"][] = "Curso {$row['course_code']} no existe en el periodo.";
            }

            if ($studentId !== null && $courseId !== null) {
                $pairs["$studentId-$courseId"] = [$studentId, $courseId];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return DB::transaction(function () use ($admin, $pairs, $rows) {
            $existing = Enrollment::query()
                ->whereIn('student_id', array_column($pairs, 0))
                ->whereIn('course_id', array_column($pairs, 1))
                ->get()
                ->keyBy(fn (Enrollment $enrollment) => "$enrollment->student_id-$enrollment->course_id");

            $summary = ['created' => 0, 'reactivated' => 0, 'skipped' => count($rows) - count($pairs)];

            foreach ($pairs as $key => [$studentId, $courseId]) {
                $enrollment = $existing->get($key);

                if ($enrollment?->status === self::ACTIVE) {
                    $summary['skipped']++;

                    continue;
                }

                $summary[$enrollment ? 'reactivated' : 'created']++;
                $this->saveActive($admin, $enrollment, $studentId, $courseId, 'enrollment.imported');
            }

            $this->auditLogger->record($admin, 'enrollment.bulk_imported', null, [], $summary);

            return $summary;
        });
    }

    public function withdraw(User $admin, Enrollment $enrollment): Enrollment
    {
        $old = ['status' => $enrollment->status];
        $enrollment->update(['status' => self::WITHDRAWN]);

        $this->auditLogger->record($admin, 'enrollment.withdrawn', $enrollment, $old, ['status' => self::WITHDRAWN]);

        return $enrollment->load(['student', 'course']);
    }

    private function saveActive(User $admin, ?Enrollment $enrollment, int $studentId, int $courseId, string $action): void
    {
        if ($enrollment) {
            $old = ['status' => $enrollment->status];
            $enrollment->update(['status' => self::ACTIVE, 'enrolled_at' => now()]);
            $this->auditLogger->record($admin, $action, $enrollment, $old, ['status' => self::ACTIVE]);

            return;
        }

        $enrollment = Enrollment::query()->create([
            'student_id' => $studentId,
            'course_id' => $courseId,
            'status' => self::ACTIVE,
            'enrolled_at' => now(),
        ]);

        $this->auditLogger->record($admin, $action, $enrollment, [], $enrollment->toArray());
    }

    /**
     * @return array<int, array{student_code: string, course_code: string}> filas indexadas por número de línea
     */
    private function readCsv(UploadedFile $file): array
    {
        $lines = preg_split('/\r\n|\r|\n/', (string) preg_replace('/^\xEF\xBB\xBF/', '', $file->getContent()));
        $delimiter = str_contains($lines[0] ?? '', ';') && ! str_contains($lines[0] ?? '', ',') ? ';' : ',';
        $header = array_map(fn ($column) => strtolower(trim($column)), str_getcsv($lines[0] ?? '', $delimiter));

        $studentIndex = array_search('student_code', $header, true);
        $courseIndex = array_search('course_code', $header, true);

        if ($studentIndex === false || $courseIndex === false) {
            throw ValidationException::withMessages([
                'file' => 'El CSV debe tener las columnas student_code y course_code.',
            ]);
        }

        $rows = [];

        foreach (array_slice($lines, 1, null, true) as $index => $line) {
            if (trim($line) === '') {
                continue;
            }

            $values = str_getcsv($line, $delimiter);
            $rows[$index + 1] = [
                'student_code' => trim($values[$studentIndex] ?? ''),
                'course_code' => trim($values[$courseIndex] ?? ''),
            ];
        }

        if ($rows === []) {
            throw ValidationException::withMessages(['file' => 'El CSV no contiene filas.']);
        }

        return $rows;
    }
}
