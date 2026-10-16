<?php

namespace Database\Seeders;

use App\Models\AcademicPeriod;
use App\Models\AiDiagnostic;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\Incident;
use App\Models\PermissionRequest;
use App\Models\ResidentialPresence;
use App\Models\RiskPrediction;
use App\Models\Student;
use App\Models\TutorMessage;
use App\Models\TutorSession;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Datos operativos de 5to A para los 5 roles (asistencia IB, incidencias, permisos, tutor).
 */
class DemoFiveRolesRecordsSeeder extends Seeder
{
    public function run(): void
    {
        $period = AcademicPeriod::query()->where('is_current', true)->first();
        $course = Course::query()->where('code', 'MAT-AA')->first();
        $teacherUser = User::query()->where('email', 'tutor@coar.edu.pe')->first();
        $monitorUser = User::query()->where('email', 'residencia@coar.edu.pe')->first();
        $valeria = Student::query()->where('student_code', 'EST-0003')->first();
        $guardian = Guardian::query()->where('email', 'apoderado@coar.edu.pe')->first();

        if ($period === null || $course === null || $teacherUser === null || $monitorUser === null || $valeria === null) {
            $this->command?->warn('DemoFiveRolesRecordsSeeder: faltan datos de DemoUserSeeder/AcademicPo01Seeder.');

            return;
        }

        $students = Student::query()->whereIn('student_code', ['EST-0001', 'EST-0002', 'EST-0003', 'EST-0004'])->get();
        $statuses = ['present', 'present', 'late', 'absent_justified', 'absent_unjustified'];
        $criteria = Grade::CRITERIA;

        foreach ($students as $index => $student) {
            foreach (['2026-04-07', '2026-04-14', '2026-04-21', '2026-04-28', '2026-05-05'] as $day => $date) {
                Attendance::query()->updateOrCreate(
                    [
                        'student_id' => $student->id,
                        'course_id' => $course->id,
                        'attendance_date' => $date,
                    ],
                    [
                        'academic_period_id' => $period->id,
                        'status' => $statuses[($index + $day) % count($statuses)],
                        'recorded_by' => $teacherUser->id,
                    ]
                );
            }

            foreach ($criteria as $criterionIndex => $criterion) {
                Grade::query()->updateOrCreate(
                    [
                        'student_id' => $student->id,
                        'course_id' => $course->id,
                        'criterion' => $criterion,
                        'evaluation_date' => '2026-05-'.sprintf('%02d', 10 + $criterionIndex),
                    ],
                    [
                        'academic_period_id' => $period->id,
                        'evaluation_name' => 'Criterio '.$criterion.' · prueba 1',
                        'score' => [6, 5, 4, 3][($index + $criterionIndex) % 4],
                        'max_score' => Grade::MAX_SCORE,
                        'recorded_by' => $teacherUser->id,
                        'recorded_at' => now()->subDays(20 - $criterionIndex),
                    ]
                );
            }

            ResidentialPresence::query()->updateOrCreate(
                [
                    'student_id' => $student->id,
                    'presence_date' => '2026-05-06',
                    'check_type' => 'night',
                ],
                [
                    'status' => $index === 3 ? 'absent' : 'present',
                    'recorded_by' => $monitorUser->id,
                ]
            );
        }

        Incident::query()->updateOrCreate(
            [
                'student_id' => $valeria->id,
                'incident_at' => '2026-04-30 21:15:00',
            ],
            [
                'reported_by' => $monitorUser->id,
                'category' => 'convivencia',
                'severity' => 'leve',
                'description' => 'Discusión breve en el pabellón; se mediaron acuerdos de convivencia.',
                'status' => 'resolved',
                'resolved_at' => '2026-05-01 08:00:00',
            ]
        );

        if ($guardian !== null) {
            PermissionRequest::query()->updateOrCreate(
                [
                    'student_id' => $valeria->id,
                    'starts_at' => '2026-05-16 08:00:00',
                ],
                [
                    'requested_by' => $valeria->user_id,
                    'guardian_id' => $guardian->id,
                    'type' => 'salida',
                    'reason' => 'Cita médica en Huancayo el sábado.',
                    'ends_at' => '2026-05-16 18:00:00',
                    'status' => PermissionRequest::STATUS_PENDING_GUARDIAN,
                ]
            );
        }

        RiskPrediction::query()->updateOrCreate(
            [
                'student_id' => $valeria->id,
                'academic_period_id' => $period->id,
            ],
            [
                'risk_level' => RiskPrediction::LEVEL_MEDIUM,
                'risk_score' => 41.50,
                'factors' => [
                    ['key' => 'grade_level', 'label' => 'Promedio IB', 'value' => 4.5, 'contribution' => 12.0],
                    ['key' => 'tardiness', 'label' => 'Tardanzas', 'value' => 0.20, 'contribution' => 5.0],
                ],
                'data_coverage' => 0.85,
                'insufficient_data' => false,
                'needs_human_review' => false,
                'recommendation' => 'Monitoreo preventivo: reforzar criterio D y puntualidad.',
                'model_version' => 'rules-1.0',
                'predicted_at' => now(),
            ]
        );

        AiDiagnostic::query()->updateOrCreate(
            [
                'type' => AiDiagnostic::TYPE_TEACHER_INSIGHT,
                'classroom_id' => $valeria->classroom_id,
                'academic_period_id' => $period->id,
            ],
            [
                'payload' => [
                    'top_gaps' => [
                        ['criterion' => 'D', 'below_4_pct' => 25.0, 'methodology' => 'práctica de recuperación'],
                    ],
                ],
                'model_version' => 'rules-1.0',
                'insufficient_data' => false,
                'generated_at' => now(),
            ]
        );

        $session = TutorSession::query()->updateOrCreate(
            [
                'student_id' => $valeria->id,
                'course_id' => $course->id,
                'topic' => 'Funciones cuadráticas',
            ],
            [
                'criterion' => 'A',
                'state' => ['step' => 'pregunta_guia'],
                'status' => TutorSession::STATUS_ACTIVE,
            ]
        );

        if ($session->messages()->doesntExist()) {
            $session->messages()->createMany([
                [
                    'role' => TutorMessage::ROLE_TUTOR,
                    'content' => '¿Qué representa el discriminante en una ecuación cuadrática?',
                    'meta' => ['step' => 'pregunta_guia'],
                ],
                [
                    'role' => TutorMessage::ROLE_STUDENT,
                    'content' => 'Creo que indica cuántas raíces reales hay.',
                    'meta' => null,
                ],
            ]);
        }
    }
}
