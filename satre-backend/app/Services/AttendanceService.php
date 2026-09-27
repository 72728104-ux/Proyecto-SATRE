<?php

namespace App\Services;

use App\Events\AttendanceRecorded;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
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
                    $attendance->update($payload);
                } else {
                    $attendance = Attendance::query()->create($payload + [
                        'student_id' => $record['student_id'],
                        'course_id' => $course->id,
                        'attendance_date' => $date,
                    ]);
                }

                $this->auditLogger->record($recorder, 'attendance.session_recorded', $attendance, [], $attendance->toArray());
                AttendanceRecorded::dispatch($attendance);
                $saved->push($attendance->load('student'));
            }

            return $saved;
        });
    }
}
