<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Support\InstitutionalIdentity;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private const LOGIN_ENDPOINT = '/api/auth/login';
    private const TUTOR_EMAIL = 'tutor@coar.edu.pe';
    private const ADMIN_EMAIL = 'admin@coar.edu.pe';
    private const ME_ENDPOINT = '/api/auth/me';

    public function test_login_validates_required_fields(): void
    {
        $this->postJson(self::LOGIN_ENDPOINT, [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $this->createUserWithRole(Roles::TEACHER, [
            'email' => self::TUTOR_EMAIL,
            'password' => 'coar2026',
        ]);

        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => self::TUTOR_EMAIL,
            'password' => 'incorrecta',
        ])->assertStatus(422);
    }

    public function test_login_accepts_institutional_email_or_dni(): void
    {
        $this->createUserWithRole(Roles::TEACHER, [
            'name' => 'Luis Mendoza Aliaga',
            'email' => InstitutionalIdentity::seededTeacherEmail(),
            'dni' => InstitutionalIdentity::TEACHER_DNI,
            'password' => 'coar2026',
        ]);

        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => InstitutionalIdentity::seededTeacherEmail(),
            'password' => 'coar2026',
        ])->assertOk()
            ->assertJsonPath('user.email', InstitutionalIdentity::seededTeacherEmail())
            ->assertJsonPath('user.dni', InstitutionalIdentity::TEACHER_DNI);

        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => InstitutionalIdentity::TEACHER_DNI,
            'password' => 'coar2026',
        ])->assertOk()
            ->assertJsonPath('user.email', InstitutionalIdentity::seededTeacherEmail())
            ->assertJsonPath('user.dni', InstitutionalIdentity::TEACHER_DNI);
    }

    public function test_login_rejects_identifier_that_is_neither_email_nor_dni(): void
    {
        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => '1234567',
            'password' => 'coar2026',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_returns_token_and_role_for_active_user(): void
    {
        $this->createUserWithRole(Roles::ADMIN, [
            'name' => 'Rosa Huamán Quispe',
            'email' => self::ADMIN_EMAIL,
            'password' => 'coar2026',
        ]);

        $response = $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => self::ADMIN_EMAIL,
            'password' => 'coar2026',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', self::ADMIN_EMAIL)
            ->assertJsonPath('user.role.slug', Roles::ADMIN)
            ->assertJsonPath('must_change_password', false)
            ->assertJsonStructure(['token', 'expires_at', 'must_change_password', 'user' => ['id', 'name', 'email', 'role']]);

        $this->assertNotEmpty($response->json('token'));
    }

    public function test_login_token_expires_in_eight_hours(): void
    {
        $this->freezeSecond();
        $this->createUserWithRole(Roles::TEACHER, [
            'email' => self::TUTOR_EMAIL,
            'password' => 'coar2026',
        ]);

        $response = $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => self::TUTOR_EMAIL,
            'password' => 'coar2026',
        ])->assertOk();

        $this->assertSame(now()->addHours(8)->toIso8601String(), $response->json('expires_at'));
        $this->assertDatabaseHas('personal_access_tokens', ['expires_at' => now()->addHours(8)]);
    }

    public function test_login_reports_must_change_password_for_new_accounts(): void
    {
        $this->createUserWithRole(Roles::STUDENT, [
            'email' => 'nuevo@coar.edu.pe',
            'password' => 'coar2026',
            'must_change_password' => true,
        ]);

        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => 'nuevo@coar.edu.pe',
            'password' => 'coar2026',
        ])->assertOk()
            ->assertJsonPath('must_change_password', true)
            ->assertJsonPath('user.must_change_password', true);
    }

    public function test_login_is_throttled_after_five_attempts(): void
    {
        $payload = ['email' => 'ataque@coar.edu.pe', 'password' => 'incorrecta'];

        for ($i = 0; $i < 5; $i++) {
            $this->postJson(self::LOGIN_ENDPOINT, $payload)->assertStatus(422);
        }

        $this->postJson(self::LOGIN_ENDPOINT, $payload)->assertStatus(429);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $this->createUserWithRole(Roles::STUDENT, [
            'email' => 'inactivo@coar.edu.pe',
            'password' => 'coar2026',
            'is_active' => false,
        ]);

        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => 'inactivo@coar.edu.pe',
            'password' => 'coar2026',
        ])->assertStatus(422);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson(self::ME_ENDPOINT)->assertUnauthorized();
    }

    public function test_authenticated_user_can_view_profile_and_logout(): void
    {
        $user = $this->createUserWithRole(Roles::MONITOR, [
            'email' => 'residencia@coar.edu.pe',
            'password' => 'coar2026',
        ]);

        $token = $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => 'residencia@coar.edu.pe',
            'password' => 'coar2026',
        ])->json('token');

        $this->withToken($token)
            ->getJson(self::ME_ENDPOINT)
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role.slug', Roles::MONITOR)
            ->assertJsonPath('user.college_has_residence', true);

        $this->withToken($token)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);

        Auth::forgetGuards();

        $this->withToken($token)
            ->getJson(self::ME_ENDPOINT)
            ->assertUnauthorized();
    }

    public function test_profile_exposes_college_residence_flag_from_config(): void
    {
        $user = $this->createUserWithRole(Roles::TEACHER, [
            'email' => self::TUTOR_EMAIL,
            'password' => 'coar2026',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson(self::ME_ENDPOINT)
            ->assertOk()
            ->assertJsonPath('user.college_has_residence', true);

        config(['app.college_has_residence' => false]);

        $this->actingAs($user, 'sanctum')
            ->getJson(self::ME_ENDPOINT)
            ->assertOk()
            ->assertJsonPath('user.college_has_residence', false);
    }

    private function createUserWithRole(string $slug, array $attributes): User
    {
        $role = Role::factory()->create([
            'slug' => $slug,
            'name' => $slug,
        ]);

        return User::factory()->create(array_merge([
            'role_id' => $role->id,
            'is_active' => true,
        ], $attributes));
    }
}
