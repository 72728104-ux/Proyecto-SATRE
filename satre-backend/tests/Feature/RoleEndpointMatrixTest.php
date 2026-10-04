<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\GuidedQuestion;
use App\Models\Incident;
use App\Models\Intervention;
use App\Models\PermissionRequest;
use App\Models\ReadingMaterial;
use App\Models\ResidentialPresence;
use App\Models\Student;
use App\Models\User;
use App\Support\Roles;
use Database\Seeders\AcademicPo01Seeder;
use Database\Seeders\DemoFiveRolesRecordsSeeder;
use Database\Seeders\DemoUserSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

/**
 * Matriz rol × endpoint de SATRE TO-BE §1 (permisos) y §4 (contrato API).
 * Los módulos sin ruta registrada se omiten con markTestSkipped para ir a verde por fase.
 */
class RoleEndpointMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_STATUSES = [200, 201, 422];

    private const DEMO_EMAILS = [
        Roles::ADMIN => 'admin@coar.edu.pe',
        Roles::TEACHER => 'tutor@coar.edu.pe',
        Roles::MONITOR => 'residencia@coar.edu.pe',
        Roles::STUDENT => 'estudiante@coar.edu.pe',
        Roles::GUARDIAN => 'apoderado@coar.edu.pe',
    ];

    /**
     * [método, ruta, roles permitidos, payload opcional]
     *
     * @return list<array{0: string, 1: string, 2: list<string>, 3?: array<string, mixed>}>
     */
    private static function endpoints(): array
    {
        $all = Roles::all();
        $admin = [Roles::ADMIN];
        $staff = [Roles::ADMIN, Roles::TEACHER, Roles::MONITOR];
        $attendanceWrite = [Roles::ADMIN, Roles::TEACHER];

        return [
            // §4.1 Auth
            ['POST', '/api/auth/login', $all],
            ['POST', '/api/auth/refresh', $all],
            ['POST', '/api/auth/logout', $all],
            ['GET', '/api/auth/me', $all],
            ['POST', '/api/auth/change-password', $all],
            ['POST', '/api/auth/forgot-password', $all],
            ['POST', '/api/auth/reset-password', $all],
            ['POST', '/api/auth/register', $admin],

            // §4.2 Admin (solo admin). apiResource = index/store/show/update/destroy.
            ['GET', '/api/admin/users', $admin],
            ['POST', '/api/admin/users', $admin],
            ['GET', '/api/admin/users/{user}', $admin],
            ['PUT', '/api/admin/users/{user}', $admin],
            ['DELETE', '/api/admin/users/{user}', $admin],
            ['PATCH', '/api/admin/users/{user}/toggle-active', $admin],
            ['POST', '/api/admin/users/{user}/reset-password', $admin],
            ['GET', '/api/admin/classrooms', $admin],
            ['POST', '/api/admin/classrooms', $admin],
            ['GET', '/api/admin/classrooms/{classroom}', $admin],
            ['PUT', '/api/admin/classrooms/{classroom}', $admin],
            ['DELETE', '/api/admin/classrooms/{classroom}', $admin],
            ['GET', '/api/admin/courses', $admin],
            ['POST', '/api/admin/courses', $admin],
            ['GET', '/api/admin/courses/{course}', $admin],
            ['PUT', '/api/admin/courses/{course}', $admin],
            ['DELETE', '/api/admin/courses/{course}', $admin],
            ['GET', '/api/admin/periods', $admin],
            ['POST', '/api/admin/periods', $admin],
            ['GET', '/api/admin/periods/{period}', $admin],
            ['PUT', '/api/admin/periods/{period}', $admin],
            ['DELETE', '/api/admin/periods/{period}', $admin],
            ['POST', '/api/admin/periods/{period}/set-current', $admin],
            ['POST', '/api/admin/enrollments', $admin],
            ['POST', '/api/admin/enrollments/bulk', $admin],
            ['DELETE', '/api/admin/enrollments/{enrollment}', $admin],
            ['POST', '/api/admin/guardians/{guardian}/students', $admin],
            ['GET', '/api/admin/metrics', $admin],
            ['GET', '/api/admin/audit-logs', $admin],

            // §4.3 Académico. §1: student R propio; guardian lee hijos vía /me/summary.
            ['GET', '/api/academic/attendances', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT]],
            ['POST', '/api/academic/attendances', $attendanceWrite, [
                'course_id' => '{course}',
                'student_id' => '{student}',
                'attendance_date' => '2026-06-15',
                'status' => 'present',
            ]],
            ['PUT', '/api/academic/attendances/{attendance}', $attendanceWrite, [
                'status' => 'late',
            ]],
            ['GET', '/api/academic/attendances/session?course_id={course}&attendance_date=2026-04-15', $attendanceWrite],
            ['POST', '/api/academic/attendances/session', $attendanceWrite, [
                'course_id' => '{course}',
                'attendance_date' => '2026-06-16',
                'records' => [['student_id' => '{student}', 'status' => 'present']],
            ]],
            ['PUT', '/api/academic/attendances/session', $attendanceWrite, [
                'course_id' => '{course}',
                'attendance_date' => '2026-06-16',
                'records' => [['student_id' => '{student}', 'status' => 'late']],
            ]],
            ['GET', '/api/academic/grades', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT]],
            ['POST', '/api/academic/grades', [Roles::TEACHER]],
            ['PUT', '/api/academic/grades/{grade}', [Roles::TEACHER]],
            ['GET', '/api/academic/presences', [Roles::ADMIN, Roles::MONITOR, Roles::STUDENT]],
            ['POST', '/api/academic/presences', [Roles::MONITOR]],
            ['PUT', '/api/academic/presences/{presence}', [Roles::MONITOR]],
            ['GET', '/api/academic/incidents', [...$staff, Roles::GUARDIAN]],
            ['POST', '/api/academic/incidents', [Roles::MONITOR]],
            ['PUT', '/api/academic/incidents/{incident}', [Roles::MONITOR]],
            ['GET', '/api/academic/permissions', [Roles::ADMIN, Roles::MONITOR, Roles::STUDENT, Roles::GUARDIAN]],
            ['POST', '/api/academic/permissions', [Roles::STUDENT]],
            ['PATCH', '/api/academic/permissions/{permission}/guardian', [Roles::GUARDIAN]],
            ['PATCH', '/api/academic/permissions/{permission}/resolve', [Roles::ADMIN, Roles::MONITOR]],
            ['GET', '/api/academic/me/summary?student_id={student}', [Roles::STUDENT, Roles::GUARDIAN]],

            // §12.2 / F14.2 Lecturas y artefactos CREATE-SATRE
            ['GET', '/api/academic/readings', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT]],
            ['POST', '/api/academic/readings', [Roles::TEACHER], [
                'course_id' => '{course}',
                'title' => 'Artículo CREATE',
                'criterion' => 'A',
                'content' => 'Texto del artículo',
            ]],
            ['PUT', '/api/academic/readings/{reading}', [Roles::TEACHER], [
                'title' => 'Artículo CREATE actualizado',
            ]],
            ['GET', '/api/academic/readings/{reading}/artifacts', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT]],
            ['POST', '/api/academic/readings/{reading}/artifacts', [Roles::STUDENT], [
                'nodes' => [['id' => 'n1', 'label' => 'Hipótesis']],
                'connections' => [['from' => 'n1', 'to' => 'n1']],
            ]],
            ['GET', '/api/academic/readings/{reading}/questions', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT]],
            ['POST', '/api/academic/readings/{reading}/questions', [Roles::STUDENT], [
                'guided_question_id' => '{question}',
                'response' => 'A',
            ]],
            ['GET', '/api/academic/readings/{reading}/quiz', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT]],
            ['POST', '/api/academic/readings/{reading}/quiz', [Roles::STUDENT], [
                'answers' => [['guided_question_id' => '{question}', 'response' => 'A']],
            ]],

            // §4.4 Reportes
            ['GET', '/api/reports/students/{student}/performance', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT, Roles::GUARDIAN]],
            ['GET', '/api/reports/classrooms/{classroom}/analytics', [Roles::ADMIN, Roles::TEACHER]],
            ['GET', '/api/reports/classrooms/{classroom}/export?format=csv', [Roles::ADMIN, Roles::TEACHER]],

            // §4.5 Alertas e intervenciones
            ['GET', '/api/alerts', $all],
            ['PATCH', '/api/alerts/{alert}', $staff],
            ['POST', '/api/alerts/{alert}/interventions', $staff],
            ['POST', '/api/interventions/{intervention}/follow-ups', $staff],

            // §4.6 IA
            ['GET', '/api/ai-analytics/teacher/insights/{classroom}', [Roles::ADMIN, Roles::TEACHER]],
            ['GET', '/api/ai-analytics/students/{student}/risk', $all],
            ['POST', '/api/ai-analytics/student/socratic-tutor', [Roles::STUDENT]],
            ['GET', '/api/ai-analytics/student/socratic-tutor/sessions', [Roles::STUDENT]],
        ];
    }

    /**
     * @return iterable<string, array{string, string, string, bool, array<string, mixed>}>
     */
    public static function matrix(): iterable
    {
        foreach (self::endpoints() as $endpoint) {
            [$method, $uri, $allowed] = $endpoint;
            $payload = $endpoint[3] ?? [];

            foreach (Roles::all() as $role) {
                yield "$role · $method $uri" => [
                    $role,
                    $method,
                    $uri,
                    in_array($role, $allowed, true),
                    $payload,
                ];
            }
        }
    }

    #[DataProvider('matrix')]
    public function test_role_access_matches_permission_matrix(
        string $role,
        string $method,
        string $uri,
        bool $allowed,
        array $payload,
    ): void {
        if (! $this->routeIsRegistered($method, $uri)) {
            $this->markTestSkipped("módulo aún no creado: $method $uri");
        }

        $this->seed([
            RoleSeeder::class,
            DemoUserSeeder::class,
            AcademicPo01Seeder::class,
            DemoFiveRolesRecordsSeeder::class,
        ]);
        User::query()->update(['must_change_password' => false]);

        [$uri, $payload] = $this->resolvePlaceholders($uri, $payload);

        $user = User::query()->where('email', self::DEMO_EMAILS[$role])->firstOrFail();
        $this->withToken($user->createToken('matrix')->plainTextToken);

        $response = $this->json($method, $uri, $payload);

        if ($allowed) {
            $this->assertContains(
                $response->status(),
                self::ALLOWED_STATUSES,
                "$role debería acceder a $method $uri (HTTP {$response->status()})"
            );
        } else {
            $response->assertForbidden();
        }
    }

    private function routeIsRegistered(string $method, string $uri): bool
    {
        $path = parse_url($uri, PHP_URL_PATH) ?: $uri;
        $path = preg_replace('/\{[a-z_]+\}/', '1', $path) ?: $path;

        try {
            app('router')->getRoutes()->match(Request::create($path, $method));

            return true;
        } catch (NotFoundHttpException|MethodNotAllowedHttpException) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{string, array<string, mixed>}
     */
    private function resolvePlaceholders(string $uri, array $payload): array
    {
        $student = Student::query()->where('student_code', 'EST-0003')->firstOrFail();
        $course = Course::query()->where('code', 'MAT-AA')->firstOrFail();
        $teacher = User::query()->where('email', self::DEMO_EMAILS[Roles::TEACHER])->firstOrFail();

        $alert = Alert::query()->first() ?? Alert::query()->create([
            'student_id' => $student->id,
            'type' => Alert::TYPE_RISK,
            'severity' => 'ALTO',
            'title' => 'Riesgo ALTO',
            'message' => 'Fixture de la matriz RBAC.',
            'status' => Alert::STATUS_OPEN,
        ]);

        $intervention = Intervention::query()->first() ?? Intervention::query()->create([
            'alert_id' => $alert->id,
            'student_id' => $student->id,
            'assigned_to' => $teacher->id,
            'type' => 'tutoria',
            'description' => 'Seguimiento de prueba para la matriz RBAC.',
            'status' => Intervention::STATUS_PLANNED,
        ]);

        $reading = ReadingMaterial::query()->first() ?? ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Artículo CREATE',
            'criterion' => 'A',
            'content' => 'Texto del artículo',
            'created_by' => $teacher->id,
        ]);

        $question = GuidedQuestion::query()->where('reading_material_id', $reading->id)->first()
            ?? GuidedQuestion::query()->create([
                'reading_material_id' => $reading->id,
                'prompt' => '¿Cuál es la hipótesis?',
                'type' => GuidedQuestion::TYPE_MULTIPLE_CHOICE,
                'options' => ['A', 'B'],
                'correct_answer' => 'A',
            ]);

        $ids = [
            '{user}' => (string) $teacher->id,
            '{classroom}' => (string) Classroom::query()->where('name', '5to A')->value('id'),
            '{course}' => (string) $course->id,
            '{period}' => (string) $course->academic_period_id,
            '{student}' => (string) $student->id,
            '{guardian}' => (string) Guardian::query()->where('email', 'apoderado@coar.edu.pe')->value('id'),
            '{enrollment}' => (string) Enrollment::query()->where('student_id', $student->id)->value('id'),
            '{attendance}' => (string) Attendance::query()->where('student_id', $student->id)->value('id'),
            '{grade}' => (string) Grade::query()->where('student_id', $student->id)->value('id'),
            '{presence}' => (string) ResidentialPresence::query()->where('student_id', $student->id)->value('id'),
            '{incident}' => (string) Incident::query()->where('student_id', $student->id)->value('id'),
            '{permission}' => (string) PermissionRequest::query()->where('student_id', $student->id)->value('id'),
            '{alert}' => (string) $alert->id,
            '{intervention}' => (string) $intervention->id,
            '{reading}' => (string) $reading->id,
            '{question}' => (string) $question->id,
        ];

        array_walk_recursive($payload, function (&$value) use ($ids): void {
            if (is_string($value) && isset($ids[$value])) {
                $value = (int) $ids[$value];
            }
        });

        return [strtr($uri, $ids), $payload];
    }
}
