<?php

namespace App\Services;

use App\Events\AttendanceRecorded;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function record(User $recorder, array $data): Attendance
    {
        $course = Course::query()->findOrFail($data['course_id']);

        $enrolled = Enrollment::query()
            ->where('student_id', $data['student_id'])
            ->where('course_id', $course->id)
            ->where('status', 'active')
            ->exists();

        if (! $enrolled) {
            throw ValidationException::withMessages([
                'student_id' => 'El estudiante no está matriculado en el curso.',
            ]);
        }

        $alreadyRecorded = Attendance::query()
            ->where('student_id', $data['student_id'])
            ->where('course_id', $course->id)
            ->whereDate('attendance_date', $data['attendance_date'])
            ->exists();

        if ($alreadyRecorded) {
            throw ValidationException::withMessages([
                'attendance_date' => 'Ya existe un registro de asistencia para este estudiante, curso y fecha.',
            ]);
        }

        $attendance = Attendance::query()->create([
            'student_id' => $data['student_id'],
            'course_id' => $course->id,
            'academic_period_id' => $course->academic_period_id,
            'attendance_date' => $data['attendance_date'],
            'status' => $data['status'],
            'recorded_by' => $recorder->id,
            'notes' => $data['notes'] ?? null,
        ]);

        $this->auditLogger->record($recorder, 'attendance.recorded', $attendance, [], $attendance->toArray());

        AttendanceRecorded::dispatch($attendance); // D2: no consolidación ni jobs de riesgo en la petición.

        return $attendance->load(['student', 'course']);
    }

    public function update(User $recorder, Attendance $attendance, array $data): Attendance
    {
        $attendance->fill($data);
        $oldValues = array_intersect_key($attendance->getRawOriginal(), $attendance->getDirty());
        $attendance->save();

        $this->auditLogger->record(
            $recorder,
            'attendance.updated',
            $attendance,
            $oldValues,
            Arr::except($attendance->getChanges(), 'updated_at')
        );

        AttendanceRecorded::dispatch($attendance);

        return $attendance->load(['student', 'course']);
    }

    /**
     * @param  array{course_id: int, attendance_date: string, records: list<array{student_id: int, status: string, notes?: string|null}>}  $data
     * @return Collection<int, Attendance>
     */
    public function saveSession(User $recorder, array $data)
    {
        $course = Course::query()->with('academicPeriod')->findOrFail($data['course_id']);
        $studentIds = collect($data['records'])->pluck('student_id');

        $enrolledIds = Enrollment::query()
            ->where('course_id', $course->id)
            ->where('status', 'active')
            ->whereIn('student_id', $studentIds)
            ->pluck('student_id');

        foreach ($data['records'] as $index => $record) {
            if (! $enrolledIds->contains($record['student_id'])) {
                throw ValidationException::withMessages([
                    "records.$index.student_id" => 'El estudiante no está matriculado en el curso.',
                ]);
            }
        }

        $date = Carbon::parse($data['attendance_date'])->toDateString();

        return DB::transaction(function () use ($recorder, $data, $course, $date) {
            $saved = collect();

            foreach ($data['records'] as $record) {
                $attendance = Attendance::query()
                    ->where('student_id', $record['student_id'])
                    ->where('course_id', $course->id)
                    ->whereDate('attendance_date', $date)
                    ->first();

                $payload = [
                    'academic_period_id' => $course->academic_period_id,
                    'status' => $record['status'],
                    'recorded_by' => $recorder->id,
                    'notes' => $record['notes'] ?? null,
                ];

                if ($attendance) {
                    $attendance->fill($payload);
                    $oldValues = array_intersect_key($attendance->getRawOriginal(), $attendance->getDirty());
                    $attendance->save();
                    $this->auditLogger->record(
                        $recorder,
                        'attendance.session_recorded',
                        $attendance,
                        $oldValues,
                        Arr::except($attendance->getChanges(), 'updated_at')
                    );
                } else {
                    $attendance = Attendance::query()->create($payload + [
                        'student_id' => $record['student_id'],
                        'course_id' => $course->id,
                        'attendance_date' => $date,
                    ]);
                    $this->auditLogger->record($recorder, 'attendance.session_recorded', $attendance, [], $attendance->toArray());
                }

                AttendanceRecorded::dispatch($attendance);
                $saved->push($attendance->load('student'));
            }

            return $saved;
        });
    }

    /**
     * @return array{course_id: int, course_name: string, classroom: array{id: int|null, name: string|null}, attendance_date: string, students: list<array<string, mixed>>}
     */
    public function sessionRoster(Course $course, string $date): array
    {
        $course->loadMissing('classroom');

        $attendances = Attendance::query()
            ->where('course_id', $course->id)
            ->whereDate('attendance_date', $date)
            ->get()
            ->keyBy('student_id');

        $students = $course->enrollments()
            ->where('status', 'active')
            ->with('student')
            ->get()
            ->map(function ($enrollment) use ($attendances) {
                $student = $enrollment->student;
                $attendance = $attendances->get($student->id);

                return [
                    'student_id' => $student->id,
                    'student_code' => $student->student_code,
                    'first_name' => $student->first_name,
                    'last_name' => $student->last_name,
                    'status' => $attendance?->status,
                    'notes' => $attendance?->notes,
                ];
            })
            ->sortBy('last_name')
            ->values()
            ->all();

        return [
            'course_id' => $course->id,
            'course_name' => $course->name,
            'classroom' => [
                'id' => $course->classroom?->id,
                'name' => $course->classroom?->name,
            ],
            'attendance_date' => $date,
            'students' => $students,
        ];
    }
}
