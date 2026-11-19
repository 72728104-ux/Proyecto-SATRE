<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const TUTOR_EMAIL = 'tutor@coar.edu.pe';
    private const LOGIN_ENDPOINT = '/api/auth/login';
    private const ME_ENDPOINT = '/api/auth/me';
    private const NEW_USER_EMAIL = 'nuevo@coar.edu.pe';
    private const CHANGE_PASSWORD_ENDPOINT = '/api/auth/change-password';
    private const REGISTER_ENDPOINT = '/api/auth/register';
    private const FORGOT_PASSWORD_ENDPOINT = '/api/auth/forgot-password';

    public function test_login_returns_token_with_eight_hour_expiration(): void
    {
        $this->freezeSecond();
        $this->user(['email' => self::TUTOR_EMAIL]);

        $response = $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => self::TUTOR_EMAIL,
            'password' => 'coar2026',
        ])->assertOk()
            ->assertJsonStructure(['token', 'expires_at', 'must_change_password', 'user']);

        $this->assertSame(now()->addHours(8)->toIso8601String(), $response->json('expires_at'));
        $this->assertDatabaseHas('personal_access_tokens', [
            'expires_at' => now()->addHours(8),
        ]);
    }

    public function test_expired_token_cannot_access_me_or_refresh(): void
    {
        $this->user(['email' => self::TUTOR_EMAIL]);
        $token = $this->login(self::TUTOR_EMAIL);

        $this->withToken($token)->getJson(self::ME_ENDPOINT)->assertOk();

        Auth::forgetGuards();
        $this->travel(8 * 60 + 1)->minutes();

        $this->withToken($token)->getJson(self::ME_ENDPOINT)->assertUnauthorized();
        Auth::forgetGuards();
        $this->withToken($token)->postJson('/api/auth/refresh')->assertUnauthorized();
    }

    public function test_first_login_forces_must_change_password_when_never_changed(): void
    {
        $this->user([
            'email' => self::NEW_USER_EMAIL,
            'must_change_password' => false,
            'password_changed_at' => null,
        ]);

        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => self::NEW_USER_EMAIL,
            'password' => 'coar2026',
        ])->assertOk()
            ->assertJsonPath('must_change_password', true)
            ->assertJsonPath('user.must_change_password', true);

        $this->assertTrue(User::query()->where('email', self::NEW_USER_EMAIL)->value('must_change_password'));
    }

    public function test_change_password_requires_ten_characters_and_clears_flag(): void
    {
        $user = $this->user([
            'email' => self::NEW_USER_EMAIL,
            'must_change_password' => true,
            'password_changed_at' => null,
        ]);
        $token = $this->login(self::NEW_USER_EMAIL);

        $this->withToken($token)->postJson(self::CHANGE_PASSWORD_ENDPOINT, [
            'current_password' => 'coar2026',
            'password' => 'Corta2026',
            'password_confirmation' => 'Corta2026',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $this->withToken($token)->postJson(self::CHANGE_PASSWORD_ENDPOINT, [
            'current_password' => 'coar2026',
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        $user->refresh();
        $this->assertFalse($user->must_change_password);
        $this->assertNotNull($user->password_changed_at);
        $this->assertTrue(Hash::check('NuevaClave2026', $user->password));
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.password_changed',
        ]);
    }

    public function test_refresh_rotates_token_and_register_is_admin_alias(): void
    {
        $this->user(['email' => 'admin@coar.edu.pe'], Roles::ADMIN);
        $oldToken = $this->login('admin@coar.edu.pe');

        $newToken = $this->withToken($oldToken)
            ->postJson('/api/auth/refresh')
            ->assertOk()
            ->json('token');

        $this->assertNotSame($oldToken, $newToken);

        Auth::forgetGuards();
        $this->withToken($oldToken)->getJson(self::ME_ENDPOINT)->assertUnauthorized();
        Auth::forgetGuards();
        $this->withToken($newToken)
            ->postJson(self::REGISTER_ENDPOINT, [
                'name' => 'Otra Admin',
                'email' => 'otra.admin@coar.edu.pe',
                'dni' => '10000099',
                'role' => Roles::ADMIN,
            ])
            ->assertCreated()
            ->assertJsonPath('data.must_change_password', true);
    }

    public function test_me_and_logout_revoke_the_current_token(): void
    {
        $user = $this->user(['email' => 'residencia@coar.edu.pe'], Roles::MONITOR);
        $token = $this->login('residencia@coar.edu.pe');

        $this->withToken($token)
            ->getJson(self::ME_ENDPOINT)
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role.slug', Roles::MONITOR);

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);

        Auth::forgetGuards();
        $this->withToken($token)->getJson(self::ME_ENDPOINT)->assertUnauthorized();
    }

    public function test_login_and_forgot_password_are_throttled(): void
    {
        $login = ['email' => 'auth-throttle@coar.edu.pe', 'password' => 'incorrecta'];

        for ($i = 0; $i < 5; $i++) {
            $this->postJson(self::LOGIN_ENDPOINT, $login)->assertStatus(422);
        }

        $this->postJson(self::LOGIN_ENDPOINT, $login)->assertStatus(429);

        Notification::fake();

        for ($i = 0; $i < 3; $i++) {
            $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => 'auth-forgot-throttle@coar.edu.pe'])->assertOk();
        }

        $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => 'auth-forgot-throttle@coar.edu.pe'])->assertStatus(429);
    }

    public function test_forgot_and_reset_password_expire_after_sixty_minutes(): void
    {
        Notification::fake();
        $user = $this->user(['email' => self::TUTOR_EMAIL, 'must_change_password' => true]);

        $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => self::TUTOR_EMAIL])->assertOk();
        Notification::assertSentTo($user, ResetPassword::class);

        $resetToken = Password::broker()->createToken($user);

        $this->travel(61)->minutes();

        $this->postJson('/api/auth/reset-password', [
            'token' => $resetToken,
            'email' => self::TUTOR_EMAIL,
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertStatus(422);

        $this->travelBack();
        $freshToken = Password::broker()->createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $freshToken,
            'email' => self::TUTOR_EMAIL,
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('NuevaClave2026', $user->password));
        $this->assertFalse($user->must_change_password);
    }

    public function test_register_is_forbidden_for_non_admin(): void
    {
        $this->user(['email' => self::TUTOR_EMAIL]);

        $this->postJson(self::REGISTER_ENDPOINT)->assertUnauthorized();

        $this->withToken($this->login(self::TUTOR_EMAIL))
            ->postJson(self::REGISTER_ENDPOINT)
            ->assertForbidden();
    }

    public function test_must_change_password_blocks_protected_routes_until_changed(): void
    {
        $this->user([
            'email' => self::NEW_USER_EMAIL,
            'must_change_password' => true,
            'password_changed_at' => null,
        ]);
        $token = $this->login(self::NEW_USER_EMAIL);

        $this->withToken($token)
            ->getJson('/api/grades')
            ->assertForbidden()
            ->assertJsonPath('must_change_password', true);

        $this->withToken($token)->postJson(self::CHANGE_PASSWORD_ENDPOINT, [
            'current_password' => 'coar2026',
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertOk();

        $this->withToken($token)->getJson('/api/grades')->assertOk();
    }

    public function test_login_sets_security_headers(): void
    {
        $this->user(['email' => self::TUTOR_EMAIL]);

        $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => self::TUTOR_EMAIL,
            'password' => 'coar2026',
        ])->assertOk()
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    private function login(string $email): string
    {
        return $this->postJson(self::LOGIN_ENDPOINT, [
            'email' => $email,
            'password' => 'coar2026',
        ])->assertOk()->json('token');
    }

    private function user(array $attributes, string $slug = Roles::TEACHER): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);

        return User::factory()->create(array_merge([
            'role_id' => $role->id,
            'password' => 'coar2026',
            'is_active' => true,
        ], $attributes));
    }
}
