<?php

namespace Database\Seeders;

use App\Models\AcademicPeriod;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\InstitutionalIdentity;
use Illuminate\Database\Seeder;

class AcademicPo01Seeder extends Seeder
{
    public function run(): void
    {
        $period = AcademicPeriod::query()->updateOrCreate(
            ['name' => '2026-I'],
            [
                'start_date' => '2026-03-01',
                'end_date' => '2026-07-31',
                'is_current' => true,
            ]
        );

        $teacherUser = User::query()
            ->where('dni', InstitutionalIdentity::TEACHER_DNI)
            ->orWhere('email', InstitutionalIdentity::seededTeacherEmail())
            ->orWhere('email', 'tutor@coar.edu.pe')
            ->first();
        $teacher = Teacher::query()->where('user_id', $teacherUser?->id)->first();

        if ($teacher === null) {
            return;
        }

        $classroom = Classroom::query()->updateOrCreate(
            ['name' => '5to A', 'academic_period_id' => $period->id],
            [
                'grade_level' => '5to',
                'capacity' => 24,
                'tutor_id' => $teacher->id,
            ]
        );

        $course = Course::query()->updateOrCreate(
            ['code' => 'MAT-AA', 'academic_period_id' => $period->id],
            [
                'name' => 'Matemáticas AA HL',
                'classroom_id' => $classroom->id,
                'teacher_id' => $teacher->id,
            ]
        );

        $valeria = Student::query()->where('student_code', 'EST-0003')->first();
        if ($valeria) {
            $valeria->update(['classroom_id' => $classroom->id]);
        }

        $students = [
            ['student_code' => 'EST-0001', 'dni' => '70111001', 'first_name' => 'Diego', 'last_name' => 'Quispe Huamán'],
            ['student_code' => 'EST-0002', 'dni' => '70111002', 'first_name' => 'Camila', 'last_name' => 'Torres Lázaro'],
            ['student_code' => 'EST-0003', 'dni' => InstitutionalIdentity::STUDENT_DNI, 'first_name' => 'Valeria', 'last_name' => 'Chávez Poma'],
            ['student_code' => 'EST-0004', 'dni' => '70111004', 'first_name' => 'Bruno', 'last_name' => 'Paredes Soto'],
        ];

        foreach ($students as $data) {
            $student = Student::query()->updateOrCreate(
                ['student_code' => $data['student_code']],
                [
                    'document_number' => $data['dni'],
                    'dni' => $data['dni'],
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'status' => 'active',
                    'is_boarder' => true,
                    'classroom_id' => $classroom->id,
                    'user_id' => $data['student_code'] === 'EST-0003' ? $valeria?->user_id : null,
                ]
            );

            Enrollment::query()->updateOrCreate(
                [
                    'student_id' => $student->id,
                    'course_id' => $course->id,
                ],
                [
                    'status' => 'active',
                    'enrolled_at' => now(),
                ]
            );
        }
    }
}
