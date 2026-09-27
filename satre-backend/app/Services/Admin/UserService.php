<?php

namespace App\Services\Admin;

use App\Models\Guardian;
use App\Models\Monitor;
use App\Models\Role;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Roles;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UserService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{name: string, email: string, role: string, password?: string|null, profile?: array<string, mixed>}  $data
     * @return array{user: User, temporary_password: ?string}
     */
    public function create(User $admin, array $data): array
    {
        $temporaryPassword = empty($data['password']) ? Str::password(12) : null;

        $user = DB::transaction(function () use ($admin, $data, $temporaryPassword) {
            $role = Role::query()->where('slug', $data['role'])->firstOrFail();

            $user = User::query()->create([
                'role_id' => $role->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'] ?? $temporaryPassword,
                'is_active' => true,
                'must_change_password' => true,
            ]);

            $this->createProfile($user, $role->slug, $data['profile'] ?? []);

            $this->auditLogger->record($admin, 'user.created', $user, [], $user->only([
                'id', 'name', 'email', 'role_id', 'is_active',
            ]) + ['role' => $role->slug]);

            return $user;
        });

        return [
            'user' => $user->load('role'),
            'temporary_password' => $temporaryPassword,
        ];
    }

    /**
     * @param  array{name?: string, email?: string}  $data
     */
    public function update(User $admin, User $user, array $data): User
    {
        $old = $user->only(array_keys($data));
        $user->update($data);

        $this->auditLogger->record($admin, 'user.updated', $user, $old, $user->only(array_keys($data)));

        return $user->load('role');
    }

    public function delete(User $admin, User $user): void
    {
        $this->ensureNotSelf($admin, $user, 'No puedes eliminar tu propia cuenta.');

        $user->loadMissing(['teacher', 'monitor', 'student', 'guardian']);

        if ($user->teacher || $user->monitor || $user->student || $user->guardian) {
            throw ValidationException::withMessages([
                'user' => 'El usuario tiene un perfil vinculado; desactívalo en lugar de eliminarlo.',
            ]);
        }

        $old = $user->only(['id', 'name', 'email', 'role_id', 'is_active']);

        DB::transaction(function () use ($admin, $user, $old) {
            $user->tokens()->delete();
            $this->auditLogger->record($admin, 'user.deleted', $user, $old, []);
            $user->delete();
        });
    }

    public function toggleActive(User $admin, User $user): User
    {
        $this->ensureNotSelf($admin, $user, 'No puedes desactivar tu propia cuenta.');

        $old = ['is_active' => $user->is_active];
        $user->forceFill(['is_active' => ! $user->is_active])->save();

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        $this->auditLogger->record($admin, 'user.active_toggled', $user, $old, ['is_active' => $user->is_active]);

        return $user->load('role');
    }

    public function resetPassword(User $admin, User $user): string
    {
        $this->ensureNotSelf($admin, $user, 'Para tu propia cuenta usa POST /api/auth/change-password.');

        $temporaryPassword = Str::password(12);
        $old = ['must_change_password' => $user->must_change_password];

        $user->forceFill([
            'password' => $temporaryPassword,
            'must_change_password' => true,
        ])->save();

        $user->tokens()->delete();

        $this->auditLogger->record($admin, 'user.password_reset_by_admin', $user, $old, [
            'must_change_password' => true,
        ]);

        return $temporaryPassword;
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    private function createProfile(User $user, string $role, array $profile): void
    {
        match ($role) {
            Roles::TEACHER => Teacher::query()->create([
                'user_id' => $user->id,
                'employee_code' => $profile['employee_code'],
                'specialty' => $profile['specialty'] ?? null,
            ]),
            Roles::MONITOR => Monitor::query()->create([
                'user_id' => $user->id,
                'employee_code' => $profile['employee_code'],
            ]),
            Roles::STUDENT => Student::query()->create([
                'user_id' => $user->id,
                'student_code' => $profile['student_code'],
                'document_number' => $profile['document_number'],
                'first_name' => $profile['first_name'],
                'last_name' => $profile['last_name'],
                'classroom_id' => $profile['classroom_id'] ?? null,
                'is_boarder' => $profile['is_boarder'] ?? true,
                'status' => 'active',
            ]),
            Roles::GUARDIAN => Guardian::query()->create([
                'user_id' => $user->id,
                'document_number' => $profile['document_number'],
                'first_name' => $profile['first_name'],
                'last_name' => $profile['last_name'],
                'phone' => $profile['phone'] ?? null,
                'email' => $user->email,
            ]),
            default => null,
        };
    }

    private function ensureNotSelf(User $admin, User $user, string $message): void
    {
        if ($admin->is($user)) {
            throw ValidationException::withMessages(['user' => $message]);
        }
    }
}
