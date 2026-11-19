<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Support\Roles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AuthTokenTest extends TestCase
{
    use RefreshDatabase;

    private const TUTOR_EMAIL = 'tutor@coar.edu.pe';
    private const REFRESH_ENDPOINT = '/api/auth/refresh';
    private const ME_ENDPOINT = '/api/auth/me';
    private const REGISTER_ENDPOINT = '/api/auth/register';
    private const ADMIN_EMAIL = 'admin@coar.edu.pe';

    public function test_refresh_rotates_token(): void
    {
        $this->createUser(Roles::TEACHER, ['email' => self::TUTOR_EMAIL]);
        $oldToken = $this->login(self::TUTOR_EMAIL);

        $response = $this->withToken($oldToken)
            ->postJson(self::REFRESH_ENDPOINT)
            ->assertOk()
            ->assertJsonStructure(['token', 'token_type', 'expires_at']);

        $newToken = $response->json('token');
        $this->assertNotSame($oldToken, $newToken);
        $this->assertDatabaseCount('personal_access_tokens', 1);

        Auth::forgetGuards();
        $this->withToken($oldToken)->getJson(self::ME_ENDPOINT)->assertUnauthorized();

        Auth::forgetGuards();
        $this->withToken($newToken)->getJson(self::ME_ENDPOINT)->assertOk();
    }

    public function test_refresh_requires_authentication(): void
    {
        $this->postJson(self::REFRESH_ENDPOINT)->assertUnauthorized();
    }

    public function test_expired_token_is_rejected(): void
    {
        $this->createUser(Roles::MONITOR, ['email' => 'residencia@coar.edu.pe']);
        $token = $this->login('residencia@coar.edu.pe');

        $this->withToken($token)->getJson(self::ME_ENDPOINT)->assertOk();

        Auth::forgetGuards();
        $this->travel(8 * 60 + 1)->minutes();

        $this->withToken($token)->getJson(self::ME_ENDPOINT)->assertUnauthorized();

        Auth::forgetGuards();
        $this->withToken($token)->postJson(self::REFRESH_ENDPOINT)->assertUnauthorized();
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson('/api/auth/logout')->assertUnauthorized();
    }

    public function test_register_requires_authentication(): void
    {
        $this->postJson(self::REGISTER_ENDPOINT)->assertUnauthorized();
    }

    public function test_register_is_forbidden_for_non_admin(): void
    {
        $this->createUser(Roles::TEACHER, ['email' => self::TUTOR_EMAIL]);

        $this->withToken($this->login(self::TUTOR_EMAIL))
            ->postJson(self::REGISTER_ENDPOINT)
            ->assertForbidden();
    }

    public function test_register_is_alias_of_admin_users_store(): void
    {
        $this->createUser(Roles::ADMIN, ['email' => self::ADMIN_EMAIL]);
        $token = $this->login(self::ADMIN_EMAIL);

        $this->withToken($token)
            ->postJson(self::REGISTER_ENDPOINT)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'dni', 'role']);

        $this->withToken($token)
            ->postJson(self::REGISTER_ENDPOINT, [
                'name' => 'Otra Admin',
                'email' => 'otra.admin@coar.edu.pe',
                'dni' => '10000099',
                'role' => Roles::ADMIN,
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::ADMIN)
            ->assertJsonPath('data.must_change_password', true);

        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created']);
    }

    public function test_register_is_blocked_until_admin_changes_password(): void
    {
        $this->createUser(Roles::ADMIN, ['email' => self::ADMIN_EMAIL, 'must_change_password' => true]);

        $this->withToken($this->login(self::ADMIN_EMAIL))
            ->postJson(self::REGISTER_ENDPOINT)
            ->assertForbidden()
            ->assertJsonPath('must_change_password', true);
    }

    private function login(string $email): string
    {
        return $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => 'coar2026',
        ])->assertOk()->json('token');
    }

    private function createUser(string $slug, array $attributes): User
    {
        $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);

        return User::factory()->create(array_merge([
            'role_id' => $role->id,
            'password' => 'coar2026',
        ], $attributes));
    }
}
