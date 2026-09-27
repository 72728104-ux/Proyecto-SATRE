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

    public function test_refresh_rotates_token(): void
    {
        $this->createUser(Roles::TEACHER, ['email' => 'tutor@coar.edu.pe']);
        $oldToken = $this->login('tutor@coar.edu.pe');

        $response = $this->withToken($oldToken)
            ->postJson('/api/auth/refresh')
            ->assertOk()
            ->assertJsonStructure(['token', 'token_type', 'expires_at']);

        $newToken = $response->json('token');
        $this->assertNotSame($oldToken, $newToken);
        $this->assertDatabaseCount('personal_access_tokens', 1);

        Auth::forgetGuards();
        $this->withToken($oldToken)->getJson('/api/auth/me')->assertUnauthorized();

        Auth::forgetGuards();
        $this->withToken($newToken)->getJson('/api/auth/me')->assertOk();
    }

    public function test_refresh_requires_authentication(): void
    {
        $this->postJson('/api/auth/refresh')->assertUnauthorized();
    }

    public function test_expired_token_is_rejected(): void
    {
        $this->createUser(Roles::MONITOR, ['email' => 'residencia@coar.edu.pe']);
        $token = $this->login('residencia@coar.edu.pe');

        $this->withToken($token)->getJson('/api/auth/me')->assertOk();

        Auth::forgetGuards();
        $this->travel(8 * 60 + 1)->minutes();

        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();

        Auth::forgetGuards();
        $this->withToken($token)->postJson('/api/auth/refresh')->assertUnauthorized();
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson('/api/auth/logout')->assertUnauthorized();
    }

    public function test_register_requires_authentication(): void
    {
        $this->postJson('/api/auth/register')->assertUnauthorized();
    }

    public function test_register_is_forbidden_for_non_admin(): void
    {
        $this->createUser(Roles::TEACHER, ['email' => 'tutor@coar.edu.pe']);

        $this->withToken($this->login('tutor@coar.edu.pe'))
            ->postJson('/api/auth/register')
            ->assertForbidden();
    }

    public function test_register_is_alias_of_admin_users_store(): void
    {
        $this->createUser(Roles::ADMIN, ['email' => 'admin@coar.edu.pe']);
        $token = $this->login('admin@coar.edu.pe');

        $this->withToken($token)
            ->postJson('/api/auth/register')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'role']);

        $this->withToken($token)
            ->postJson('/api/auth/register', [
                'name' => 'Otra Admin',
                'email' => 'otra.admin@coar.edu.pe',
                'role' => Roles::ADMIN,
            ])
            ->assertCreated()
            ->assertJsonPath('data.role.slug', Roles::ADMIN)
            ->assertJsonPath('data.must_change_password', true);

        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created']);
    }

    public function test_register_is_blocked_until_admin_changes_password(): void
    {
        $this->createUser(Roles::ADMIN, ['email' => 'admin@coar.edu.pe', 'must_change_password' => true]);

        $this->withToken($this->login('admin@coar.edu.pe'))
            ->postJson('/api/auth/register')
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
