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

class AuthPasswordTest extends TestCase
{
    use RefreshDatabase;

    private const NEW_USER_EMAIL = 'nuevo@coar.edu.pe';
    private const CHANGE_PASSWORD_ENDPOINT = '/api/auth/change-password';
    private const TUTOR_EMAIL = 'tutor@coar.edu.pe';
    private const FORGOT_PASSWORD_ENDPOINT = '/api/auth/forgot-password';
    private const UNKNOWN_EMAIL = 'nadie@coar.edu.pe';
    private const RESET_PASSWORD_ENDPOINT = '/api/auth/reset-password';

    public function test_user_must_change_password_can_change_it(): void
    {
        $user = $this->createUser(['email' => self::NEW_USER_EMAIL, 'must_change_password' => true]);
        $token = $this->login(self::NEW_USER_EMAIL);

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
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'auth.password_changed']);

        Auth::forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();
    }

    public function test_change_password_rejects_less_than_ten_characters(): void
    {
        $this->createUser(['email' => self::NEW_USER_EMAIL, 'must_change_password' => true]);

        $this->withToken($this->login(self::NEW_USER_EMAIL))
            ->postJson(self::CHANGE_PASSWORD_ENDPOINT, [
                'current_password' => 'coar2026',
                'password' => 'Corta2026',
                'password_confirmation' => 'Corta2026',
            ])->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_change_password_rejects_wrong_current_password_and_mismatch(): void
    {
        $this->createUser(['email' => self::NEW_USER_EMAIL]);

        $this->withToken($this->login(self::NEW_USER_EMAIL))
            ->postJson(self::CHANGE_PASSWORD_ENDPOINT, [
                'current_password' => 'incorrecta',
                'password' => 'NuevaClave2026',
                'password_confirmation' => 'OtraClave2026',
            ])->assertStatus(422)
            ->assertJsonValidationErrors(['current_password', 'password']);
    }

    public function test_change_password_requires_authentication(): void
    {
        $this->postJson(self::CHANGE_PASSWORD_ENDPOINT, [])->assertUnauthorized();
    }

    public function test_forgot_password_sends_reset_link_to_active_user(): void
    {
        Notification::fake();
        $user = $this->createUser(['email' => self::TUTOR_EMAIL]);

        $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => self::TUTOR_EMAIL])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;

            return str_starts_with($url, 'http://localhost:5173/reset-password?token=');
        });
        $this->assertDatabaseHas('password_reset_tokens', ['email' => self::TUTOR_EMAIL]);
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        Notification::fake();

        $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => self::UNKNOWN_EMAIL])
            ->assertOk()
            ->assertJsonStructure(['message']);

        Notification::assertNothingSent();
    }

    public function test_forgot_password_validates_email(): void
    {
        $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => 'no-es-correo'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_forgot_password_is_throttled(): void
    {
        Notification::fake();

        for ($i = 0; $i < 3; $i++) {
            $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => self::UNKNOWN_EMAIL])->assertOk();
        }

        $this->postJson(self::FORGOT_PASSWORD_ENDPOINT, ['email' => self::UNKNOWN_EMAIL])->assertStatus(429);
    }

    public function test_reset_password_with_valid_token(): void
    {
        $user = $this->createUser(['email' => self::TUTOR_EMAIL, 'must_change_password' => true]);
        $user->createToken('web');
        $resetToken = Password::broker()->createToken($user);

        $this->postJson(self::RESET_PASSWORD_ENDPOINT, [
            'token' => $resetToken,
            'email' => self::TUTOR_EMAIL,
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('NuevaClave2026', $user->password));
        $this->assertFalse($user->must_change_password);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => self::TUTOR_EMAIL]);
    }

    public function test_reset_password_rejects_invalid_token(): void
    {
        $this->createUser(['email' => self::TUTOR_EMAIL]);

        $this->postJson(self::RESET_PASSWORD_ENDPOINT, [
            'token' => str_repeat('a', 64),
            'email' => self::TUTOR_EMAIL,
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_reset_password_rejects_token_older_than_sixty_minutes(): void
    {
        $user = $this->createUser(['email' => self::TUTOR_EMAIL]);
        $resetToken = Password::broker()->createToken($user);

        $this->travel(61)->minutes();

        $this->postJson(self::RESET_PASSWORD_ENDPOINT, [
            'token' => $resetToken,
            'email' => self::TUTOR_EMAIL,
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('coar2026', $user->fresh()->password));
    }

    public function test_reset_password_rejects_short_password(): void
    {
        $this->postJson(self::RESET_PASSWORD_ENDPOINT, [
            'token' => str_repeat('a', 64),
            'email' => self::TUTOR_EMAIL,
            'password' => 'corta',
            'password_confirmation' => 'corta',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_reset_password_rejects_short_or_oversized_token(): void
    {
        $payload = [
            'email' => self::TUTOR_EMAIL,
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ];

        $this->postJson(self::RESET_PASSWORD_ENDPOINT, ['token' => 'token-corto', ...$payload])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['token']);

        $this->postJson(self::RESET_PASSWORD_ENDPOINT, ['token' => str_repeat('a', 129), ...$payload])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['token']);
    }

    public function test_reset_password_is_throttled(): void
    {
        $payload = [
            'token' => str_repeat('a', 64),
            'email' => 'auth-reset-throttle@coar.edu.pe',
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ];

        for ($i = 0; $i < 5; $i++) {
            $this->postJson(self::RESET_PASSWORD_ENDPOINT, $payload)->assertStatus(422);
        }

        $this->postJson(self::RESET_PASSWORD_ENDPOINT, $payload)->assertStatus(429);
    }

    private function login(string $email): string
    {
        return $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => 'coar2026',
        ])->assertOk()->json('token');
    }

    private function createUser(array $attributes): User
    {
        $role = Role::query()->firstOrCreate(['slug' => Roles::TEACHER], ['name' => 'Docente']);

        return User::factory()->create(array_merge([
            'role_id' => $role->id,
            'password' => 'coar2026',
        ], $attributes));
    }
}
