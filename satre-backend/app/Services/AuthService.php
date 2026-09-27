<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @return array{token: string, expires_at: Carbon, user: User}
     */
    public function login(string $email, string $password): array
    {
        $user = User::query()->with('role')->where('email', $email)->first();

        if ($user === null || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Las credenciales no son válidas.',
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => 'La cuenta está inactiva.',
            ]);
        }

        $user->tokens()->delete();
        $issued = $this->issueToken($user);
        $user->forceFill(['last_login_at' => now()])->save();

        $this->auditLogger->record($user, 'auth.login', $user);

        return $issued + ['user' => $user];
    }

    /**
     * @return array{token: string, expires_at: Carbon}
     */
    public function refresh(User $user): array
    {
        $user->currentAccessToken()->delete();
        $issued = $this->issueToken($user);

        $this->auditLogger->record($user, 'auth.refresh', $user);

        return $issued;
    }

    public function logout(User $user): void
    {
        $user->tokens()->delete();
        $this->auditLogger->record($user, 'auth.logout', $user);
    }

    public function changePassword(User $user, string $newPassword): void
    {
        $old = ['must_change_password' => $user->must_change_password];

        $user->forceFill([
            'password' => $newPassword,
            'must_change_password' => false,
            'password_changed_at' => now(),
        ])->save();

        $user->tokens()->where('id', '!=', $user->currentAccessToken()->getKey())->delete();

        $this->auditLogger->record($user, 'auth.password_changed', $user, $old, [
            'must_change_password' => false,
        ]);
    }

    public function sendResetLink(string $email): void
    {
        $user = User::query()->where('email', $email)->where('is_active', true)->first();

        if ($user === null) {
            return;
        }

        $status = Password::sendResetLink(['email' => $email]);

        if ($status === Password::RESET_LINK_SENT) {
            $this->auditLogger->record($user, 'auth.password_reset_requested', $user);
        }
    }

    /**
     * @param  array{token: string, email: string, password: string, password_confirmation?: string}  $credentials
     */
    public function resetPassword(array $credentials): void
    {
        $status = Password::reset($credentials, function (User $user, string $password) {
            $old = ['must_change_password' => $user->must_change_password];

            $user->forceFill([
                'password' => $password,
                'must_change_password' => false,
                'password_changed_at' => now(),
            ])->save();

            $user->tokens()->delete();

            $this->auditLogger->record($user, 'auth.password_reset', $user, $old, [
                'must_change_password' => false,
            ]);
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => 'El enlace de restablecimiento no es válido o ha expirado.',
            ]);
        }
    }

    /**
     * @return array{token: string, expires_at: Carbon}
     */
    private function issueToken(User $user): array
    {
        $expiresAt = now()->addMinutes((int) config('sanctum.expiration'));

        return [
            'token' => $user->createToken('web', ['*'], $expiresAt)->plainTextToken,
            'expires_at' => $expiresAt,
        ];
    }
}
