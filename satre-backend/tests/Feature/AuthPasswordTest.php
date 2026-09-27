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

    public function test_user_must_change_password_can_change_it(): void
    {
        $user = $this->createUser(['email' => 'nuevo@coar.edu.pe', 'must_change_password' => true]);
        $token = $this->login('nuevo@coar.edu.pe');

        $this->withToken($token)->postJson('/api/auth/change-password', [
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
        $this->createUser(['email' => 'nuevo@coar.edu.pe', 'must_change_password' => true]);

        $this->withToken($this->login('nuevo@coar.edu.pe'))
            ->postJson('/api/auth/change-password', [
                'current_password' => 'coar2026',
                'password' => 'Corta2026',
                'password_confirmation' => 'Corta2026',
            ])->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_change_password_rejects_wrong_current_password_and_mismatch(): void
    {
        $this->createUser(['email' => 'nuevo@coar.edu.pe']);

        $this->withToken($this->login('nuevo@coar.edu.pe'))
            ->postJson('/api/auth/change-password', [
                'current_password' => 'incorrecta',
                'password' => 'NuevaClave2026',
                'password_confirmation' => 'OtraClave2026',
            ])->assertStatus(422)
            ->assertJsonValidationErrors(['current_password', 'password']);
    }

    public function test_change_password_requires_authentication(): void
    {
        $this->postJson('/api/auth/change-password', [])->assertUnauthorized();
    }

    public function test_forgot_password_sends_reset_link_to_active_user(): void
    {
        Notification::fake();
        $user = $this->createUser(['email' => 'tutor@coar.edu.pe']);

        $this->postJson('/api/auth/forgot-password', ['email' => 'tutor@coar.edu.pe'])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;

            return str_starts_with($url, 'http://localhost:5173/reset-password?token=');
        });
        $this->assertDatabaseHas('password_reset_tokens', ['email' => 'tutor@coar.edu.pe']);
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'nadie@coar.edu.pe'])
            ->assertOk()
            ->assertJsonStructure(['message']);

        Notification::assertNothingSent();
    }

    public function test_forgot_password_validates_email(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'no-es-correo'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_forgot_password_is_throttled(): void
    {
        Notification::fake();

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/forgot-password', ['email' => 'nadie@coar.edu.pe'])->assertOk();
        }

        $this->postJson('/api/auth/forgot-password', ['email' => 'nadie@coar.edu.pe'])->assertStatus(429);
    }

    public function test_reset_password_with_valid_token(): void
    {
        $user = $this->createUser(['email' => 'tutor@coar.edu.pe', 'must_change_password' => true]);
        $user->createToken('web');
        $resetToken = Password::broker()->createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $resetToken,
            'email' => 'tutor@coar.edu.pe',
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('NuevaClave2026', $user->password));
        $this->assertFalse($user->must_change_password);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'tutor@coar.edu.pe']);
    }

    public function test_reset_password_rejects_invalid_token(): void
    {
        $this->createUser(['email' => 'tutor@coar.edu.pe']);

        $this->postJson('/api/auth/reset-password', [
            'token' => 'token-falso',
            'email' => 'tutor@coar.edu.pe',
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_reset_password_rejects_token_older_than_sixty_minutes(): void
    {
        $user = $this->createUser(['email' => 'tutor@coar.edu.pe']);
        $resetToken = Password::broker()->createToken($user);

        $this->travel(61)->minutes();

        $this->postJson('/api/auth/reset-password', [
            'token' => $resetToken,
            'email' => 'tutor@coar.edu.pe',
            'password' => 'NuevaClave2026',
            'password_confirmation' => 'NuevaClave2026',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('coar2026', $user->fresh()->password));
    }

    public function test_reset_password_rejects_short_password(): void
    {
        $this->postJson('/api/auth/reset-password', [
            'token' => 'x',
            'email' => 'tutor@coar.edu.pe',
            'password' => 'corta',
            'password_confirmation' => 'corta',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
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
