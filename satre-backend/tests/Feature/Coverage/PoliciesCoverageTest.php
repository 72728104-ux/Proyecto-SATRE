<?php

namespace Tests\Feature\Coverage;

use App\Models\AcademicPeriod;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\ReadingMaterial;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Policies\AttendancePolicy;
use App\Policies\GradePolicy;
use App\Policies\GuidedResponsePolicy;
use App\Policies\QuizAttemptPolicy;
use App\Policies\ReadingMaterialPolicy;
use App\Policies\StudentArtifactPolicy;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Cubre todas las ramas de las políticas de lectura, asistencia y notas.
 */
class PoliciesCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendance_policy_covers_all_role_and_course_branches(): void
    {
        $policy = new AttendancePolicy;

        $admin = $this->userWithRole(Roles::ADMIN);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $otherTeacherUser = $this->userWithRole(Roles::TEACHER);
        $otherTeacher = Teacher::factory()->create(['user_id' => $otherTeacherUser->id]);
        $teacherWithoutProfile = $this->userWithRole(Roles::TEACHER);
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student = Student::factory()->create(['user_id' => $studentUser->id]);
        $otherStudentUser = $this->userWithRole(Roles::STUDENT);
        Student::factory()->create(['user_id' => $otherStudentUser->id]);
        $monitor = $this->userWithRole(Roles::MONITOR);

        $course = Course::factory()->create(['teacher_id' => $teacher->id]);
        $foreignCourse = Course::factory()->create(['teacher_id' => $otherTeacher->id]);
        $attendance = Attendance::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
        ]);
        $foreignAttendance = Attendance::factory()->create([
            'student_id' => Student::factory()->create()->id,
            'course_id' => $foreignCourse->id,
        ]);

        foreach ([$admin, $teacherUser, $studentUser] as $allowed) {
            $this->assertTrue($policy->viewAny($allowed));
        }
        $this->assertFalse($policy->viewAny($monitor));

        $this->assertTrue($policy->create($admin, $course));
        $this->assertTrue($policy->create($admin));
        $this->assertTrue($policy->create($teacherUser));
        $this->assertTrue($policy->create($teacherUser, $course));
        $this->assertFalse($policy->create($teacherUser, $foreignCourse));
        $this->assertFalse($policy->create($teacherWithoutProfile, $course));
        $this->assertFalse($policy->create($studentUser, $course));

        $this->assertTrue($policy->view($admin, $attendance));
        $this->assertTrue($policy->view($teacherUser, $attendance));
        $this->assertFalse($policy->view($otherTeacherUser, $attendance));
        $this->assertFalse($policy->view($teacherWithoutProfile, $attendance));
        $this->assertTrue($policy->view($studentUser, $attendance));
        $this->assertFalse($policy->view($otherStudentUser, $attendance));
        $this->assertFalse($policy->view($monitor, $attendance));

        $this->assertTrue($policy->update($admin, $attendance));
        $this->assertTrue($policy->update($teacherUser, $attendance));
        $this->assertFalse($policy->update($otherTeacherUser, $attendance));
        $this->assertFalse($policy->update($studentUser, $attendance));

        // Ramas con curso nulo en relaciones.
        $attendanceWithoutCourse = new Attendance;
        $attendanceWithoutCourse->setRelation('course', null);
        $this->assertFalse($policy->view($teacherUser, $attendanceWithoutCourse));
        $this->assertFalse($policy->update($teacherUser, $attendanceWithoutCourse));

        // El curso ajeno existe pero no es del docente.
        $this->assertFalse($policy->view($teacherUser, $foreignAttendance));
    }

    public function test_reading_material_policy_covers_admin_teacher_and_student_branches(): void
    {
        $policy = new ReadingMaterialPolicy;

        $admin = $this->userWithRole(Roles::ADMIN);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $otherTeacherUser = $this->userWithRole(Roles::TEACHER);
        $otherTeacher = Teacher::factory()->create(['user_id' => $otherTeacherUser->id]);
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student = Student::factory()->create(['user_id' => $studentUser->id]);
        $studentWithoutProfile = $this->userWithRole(Roles::STUDENT);
        $monitor = $this->userWithRole(Roles::MONITOR);

        $course = Course::factory()->create(['teacher_id' => $teacher->id]);
        $foreignCourse = Course::factory()->create(['teacher_id' => $otherTeacher->id]);
        Enrollment::factory()->create(['student_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $reading = ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Lectura',
            'created_by' => $teacherUser->id,
        ]);
        $foreignReading = ReadingMaterial::query()->create([
            'course_id' => $foreignCourse->id,
            'title' => 'Ajena',
            'created_by' => $otherTeacherUser->id,
        ]);

        $this->assertTrue($policy->viewAny($admin));
        $this->assertTrue($policy->viewAny($teacherUser));
        $this->assertTrue($policy->viewAny($studentUser));
        $this->assertFalse($policy->viewAny($monitor));

        $this->assertTrue($policy->view($admin, $reading));
        $this->assertTrue($policy->view($teacherUser, $reading));
        $this->assertFalse($policy->view($otherTeacherUser, $reading));
        $this->assertTrue($policy->view($studentUser, $reading));
        $this->assertFalse($policy->view($studentWithoutProfile, $reading));
        $this->assertFalse($policy->view($monitor, $reading));

        $this->assertTrue($policy->create($teacherUser));
        $this->assertTrue($policy->create($teacherUser, $course));
        $this->assertFalse($policy->create($teacherUser, $foreignCourse));
        $this->assertFalse($policy->create($studentUser, $course));
        $this->assertFalse($policy->create($admin, $course));

        $this->assertTrue($policy->update($teacherUser, $reading));
        $this->assertFalse($policy->update($otherTeacherUser, $reading));
        $this->assertFalse($policy->update($admin, $foreignReading));

        $readingWithoutCourse = new ReadingMaterial;
        $readingWithoutCourse->setRelation('course', null);
        $this->assertFalse($policy->view($teacherUser, $readingWithoutCourse));
        $this->assertFalse($policy->update($teacherUser, $readingWithoutCourse));
    }

    public function test_shared_reading_access_trait_covers_artifact_and_quiz_branches(): void
    {
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student = Student::factory()->create(['user_id' => $studentUser->id]);
        $studentWithoutProfile = $this->userWithRole(Roles::STUDENT);
        $admin = $this->userWithRole(Roles::ADMIN);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        Teacher::factory()->create(['user_id' => $teacherUser->id]);

        $course = Course::factory()->create();
        Enrollment::factory()->create(['student_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $reading = ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Lectura',
            'created_by' => $teacherUser->id,
        ]);
        $foreignCourse = Course::factory()->create();
        $foreignReading = ReadingMaterial::query()->create([
            'course_id' => $foreignCourse->id,
            'title' => 'Ajena',
            'created_by' => $teacherUser->id,
        ]);

        foreach ([new StudentArtifactPolicy, new QuizAttemptPolicy] as $policy) {
            $this->assertTrue($policy->viewAny($admin));
            $this->assertTrue($policy->viewAny($teacherUser));
            $this->assertTrue($policy->viewAny($studentUser));
            $this->assertFalse($policy->viewAny($this->userWithRole(Roles::GUARDIAN)));

            // Estudiante sin perfil.
            $this->assertFalse($policy->create($studentWithoutProfile));
            $this->assertFalse($policy->create($studentWithoutProfile, $reading));

            // Sin lectura: basta ser estudiante con perfil.
            $this->assertTrue($policy->create($studentUser));
            $this->assertTrue($policy->create($studentUser, null));

            // Matriculado / no matriculado.
            $this->assertTrue($policy->create($studentUser, $reading));
            $this->assertFalse($policy->create($studentUser, $foreignReading));

            // Admin y docente no crean artefactos/quizzes como estudiante.
            $this->assertFalse($policy->create($admin, $reading));
            $this->assertFalse($policy->create($teacherUser, $reading));
        }
    }

    public function test_guided_response_policy_covers_student_enrollment_branches(): void
    {
        $policy = new GuidedResponsePolicy;

        $studentUser = $this->userWithRole(Roles::STUDENT);
        $student = Student::factory()->create(['user_id' => $studentUser->id]);
        $studentWithoutProfile = $this->userWithRole(Roles::STUDENT);
        $admin = $this->userWithRole(Roles::ADMIN);

        $course = Course::factory()->create();
        Enrollment::factory()->create(['student_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $reading = ReadingMaterial::query()->create([
            'course_id' => $course->id,
            'title' => 'Lectura',
            'created_by' => $admin->id,
        ]);
        $foreignReading = ReadingMaterial::query()->create([
            'course_id' => Course::factory()->create()->id,
            'title' => 'Ajena',
            'created_by' => $admin->id,
        ]);

        $this->assertFalse($policy->create($studentWithoutProfile));
        $this->assertFalse($policy->create($admin));
        $this->assertTrue($policy->create($studentUser));
        $this->assertTrue($policy->create($studentUser, null));
        $this->assertTrue($policy->create($studentUser, $reading));
        $this->assertFalse($policy->create($studentUser, $foreignReading));
    }

    public function test_grade_policy_covers_teacher_and_course_branches(): void
    {
        $policy = new GradePolicy;

        $admin = $this->userWithRole(Roles::ADMIN);
        $studentUser = $this->userWithRole(Roles::STUDENT);
        $teacherUser = $this->userWithRole(Roles::TEACHER);
        $teacher = Teacher::factory()->create(['user_id' => $teacherUser->id]);
        $teacherWithoutProfile = $this->userWithRole(Roles::TEACHER);
        $otherTeacherUser = $this->userWithRole(Roles::TEACHER);
        $otherTeacher = Teacher::factory()->create(['user_id' => $otherTeacherUser->id]);

        $course = Course::factory()->create(['teacher_id' => $teacher->id]);
        $foreignCourse = Course::factory()->create(['teacher_id' => $otherTeacher->id]);
        $grade = Grade::factory()->create(['course_id' => $course->id]);
        $foreignGrade = Grade::factory()->create(['course_id' => $foreignCourse->id]);

        $this->assertTrue($policy->viewAny($admin));
        $this->assertTrue($policy->viewAny($teacherUser));
        $this->assertTrue($policy->viewAny($studentUser));
        $this->assertFalse($policy->viewAny($this->userWithRole(Roles::MONITOR)));

        $this->assertTrue($policy->create($teacherUser));
        $this->assertTrue($policy->create($teacherUser, $course));
        $this->assertFalse($policy->create($teacherUser, $foreignCourse));
        $this->assertFalse($policy->create($teacherWithoutProfile, $course));
        $this->assertFalse($policy->create($studentUser, $course));

        $this->assertTrue($policy->update($teacherUser, $grade));
        $this->assertFalse($policy->update($otherTeacherUser, $grade));
        $this->assertFalse($policy->update($teacherUser, $foreignGrade));
        $this->assertFalse($policy->update($studentUser, $grade));

        $gradeWithoutCourse = new Grade;
        $gradeWithoutCourse->setRelation('course', null);
        $this->assertFalse($policy->update($teacherUser, $gradeWithoutCourse));
    }

    private function userWithRole(string $slug): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);

        return User::factory()->create([
            'role_id' => $role->id,
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
