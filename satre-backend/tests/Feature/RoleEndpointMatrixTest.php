<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\Course;
use App\Models\Student;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Matriz rol × endpoint de SATRE_TOBE.md §1, con las rutas de §4.
 * Los endpoints con fase son los que aún no existen; se omiten hasta esa fase de §10.2.
 */
class RoleEndpointMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const GUEST = 'guest';

    private const DEMO_EMAILS = [
        Roles::ADMIN => 'admin@coar.edu.pe',
        Roles::TEACHER => 'tutor@coar.edu.pe',
        Roles::MONITOR => 'residencia@coar.edu.pe',
        Roles::STUDENT => 'estudiante@coar.edu.pe',
        Roles::GUARDIAN => 'apoderado@coar.edu.pe',
    ];

    /**
     * [método, ruta, roles permitidos, fase pendiente, payload opcional]
     *
     * @return list<array{0: string, 1: string, 2: list<string>, 3: ?string, 4?: array<string, mixed>}>
     */
    private static function endpoints(): array
    {
        $all = Roles::all();
        $admin = [Roles::ADMIN];
        $staff = [Roles::ADMIN, Roles::TEACHER, Roles::MONITOR];

        return [
            // §4.1 Auth (F2)
            ['GET', '/api/auth/me', $all, null],
            ['POST', '/api/auth/refresh', $all, null],
            ['POST', '/api/auth/logout', $all, null],
            ['POST', '/api/auth/change-password', $all, null],
            ['POST', '/api/auth/register', $admin, null],

            // §4.3 Asistencia de aula (existente): teacher CRU sus cursos; admin también escribe (decisión sobre §1)
            ['GET', '/api/courses', [Roles::ADMIN, Roles::TEACHER], null],
            ['GET', '/api/courses/{course}/attendance-session?attendance_date=2026-04-15', [Roles::ADMIN, Roles::TEACHER], null],
            ['GET', '/api/attendances', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT], null],
            ['POST', '/api/attendances', [Roles::ADMIN, Roles::TEACHER], null, [
                'course_id' => '{course}',
                'student_id' => '{student}',
                'attendance_date' => '2026-04-15',
                'status' => 'present',
            ]],
            ['POST', '/api/attendances/session', [Roles::ADMIN, Roles::TEACHER], null, [
                'course_id' => '{course}',
                'attendance_date' => '2026-04-15',
                'records' => [['student_id' => '{student}', 'status' => 'present']],
            ]],

            // §4.2 Admin: solo admin
            ['GET', '/api/admin/users', $admin, null],
            ['POST', '/api/admin/users', $admin, null],
            ['PATCH', '/api/admin/users/1/toggle-active', $admin, null],
            ['POST', '/api/admin/users/1/reset-password', $admin, null],
            ['GET', '/api/admin/classrooms', $admin, null],
            ['POST', '/api/admin/classrooms', $admin, null],
            ['GET', '/api/admin/courses', $admin, null],
            ['POST', '/api/admin/courses', $admin, null],
            ['GET', '/api/admin/periods', $admin, null],
            ['POST', '/api/admin/periods/1/set-current', $admin, null],
            ['POST', '/api/admin/enrollments', $admin, null],
            ['DELETE', '/api/admin/enrollments/1', $admin, null],
            ['POST', '/api/admin/guardians/1/students', $admin, null],
            ['GET', '/api/admin/metrics', $admin, null],
            ['GET', '/api/admin/audit-logs', $admin, null],

            // §4.3 Académico (F5)
            ['GET', '/api/grades', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT], null],
            ['POST', '/api/grades', [Roles::TEACHER], null],
            ['PUT', '/api/grades/1', [Roles::TEACHER], null],
            ['GET', '/api/presences', [Roles::ADMIN, Roles::MONITOR, Roles::STUDENT], null],
            ['POST', '/api/presences', [Roles::MONITOR], null],
            ['PUT', '/api/presences/1', [Roles::MONITOR], null],
            ['POST', '/api/presences/bulk', [Roles::MONITOR], null],
            ['GET', '/api/residents', [Roles::ADMIN, Roles::MONITOR], null],
            ['GET', '/api/incidents', [...$staff, Roles::GUARDIAN], null],
            ['POST', '/api/incidents', [Roles::MONITOR], null],
            ['PUT', '/api/incidents/1', [Roles::MONITOR], null],
            ['GET', '/api/permissions', [Roles::ADMIN, Roles::MONITOR, Roles::STUDENT, Roles::GUARDIAN], null],
            ['POST', '/api/permissions', [Roles::STUDENT], null],
            ['PATCH', '/api/permissions/1/guardian', [Roles::GUARDIAN], null],
            ['PATCH', '/api/permissions/1/resolve', [Roles::ADMIN, Roles::MONITOR], null],
            ['GET', '/api/me/summary', [Roles::STUDENT, Roles::GUARDIAN], null],

            // §4.5 Alertas e intervenciones
            ['GET', '/api/alerts', $all, null],
            ['PATCH', '/api/alerts/1', $staff, null],
            ['POST', '/api/alerts/1/interventions', $staff, null],
            ['POST', '/api/interventions/1/follow-ups', $staff, null],

            // §4.6 IA (F8 puente; tutor socrático en F11)
            ['GET', '/api/ai-analytics/teacher/insights/{classroom}', [Roles::ADMIN, Roles::TEACHER], null],
            ['GET', '/api/ai-analytics/students/{student}/risk', $all, null],
            ['POST', '/api/ai-analytics/student/socratic-tutor', [Roles::STUDENT], null],
            ['GET', '/api/ai-analytics/student/socratic-tutor/sessions', [Roles::STUDENT], null],

            // §4.4 Reportes (F11)
            ['GET', '/api/reports/students/{student}/performance', [Roles::ADMIN, Roles::TEACHER, Roles::STUDENT, Roles::GUARDIAN], 'F11'],
            ['GET', '/api/reports/classrooms/{classroom}/analytics', [Roles::ADMIN, Roles::TEACHER], 'F11'],
            ['GET', '/api/reports/classrooms/{classroom}/export?format=csv', [Roles::ADMIN, Roles::TEACHER], 'F11'],
        ];
    }

    /**
     * @return iterable<string, array{string, string, string, bool, ?string, array<string, mixed>}>
     */
    public static function matrix(): iterable
    {
        foreach (self::endpoints() as $endpoint) {
            [$method, $uri, $allowed, $phase] = $endpoint;
            $payload = $endpoint[4] ?? [];

            foreach ([self::GUEST, ...Roles::all()] as $role) {
                yield "$role · $method $uri" => [$role, $method, $uri, in_array($role, $allowed, true), $phase, $payload];
            }
        }
    }

    #[DataProvider('matrix')]
    public function test_role_access_matches_permission_matrix(
        string $role,
        string $method,
        string $uri,
        bool $allowed,
        ?string $phase,
        array $payload,
    ): void {
        if ($phase !== null) {
            $this->markTestSkipped("pendiente FASE $phase");
        }

        $this->seed();
        // La matriz evalúa el rol, no el cambio obligatorio de contraseña.
        User::query()->update(['must_change_password' => false]);

        [$uri, $payload] = $this->resolvePlaceholders($uri, $payload);

        if ($role !== self::GUEST) {
            $user = User::query()->where('email', self::DEMO_EMAILS[$role])->firstOrFail();
            $this->withToken($user->createToken('matrix')->plainTextToken);
        }

        $response = $this->json($method, $uri, $payload);

        if ($role === self::GUEST) {
            $response->assertUnauthorized();
        } elseif ($allowed) {
            $this->assertNotContains($response->status(), [401, 403], "$role debería acceder a $method $uri");
        } else {
            $response->assertForbidden();
        }
    }

    /**
     * @return array{string, array<string, mixed>}
     */
    private function resolvePlaceholders(string $uri, array $payload): array
    {
        $ids = [
            '{course}' => (string) Course::query()->where('code', 'MAT-AA')->value('id'),
            '{classroom}' => (string) Classroom::query()->where('name', '5to A')->value('id'),
            '{student}' => (string) Student::query()->where('student_code', 'EST-0003')->value('id'),
        ];

        array_walk_recursive($payload, function (&$value) use ($ids) {
            if (is_string($value) && isset($ids[$value])) {
                $value = (int) $ids[$value];
            }
        });

        return [strtr($uri, $ids), $payload];
    }
}
