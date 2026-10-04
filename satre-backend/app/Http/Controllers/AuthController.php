<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login(LoginRequest $request, AuthService $authService): JsonResponse
    {
        $result = $authService->login($request->validated('email'), $request->validated('password'));

        return response()->json([
            'token' => $result['token'],
            'token_type' => 'Bearer',
            'expires_at' => $result['expires_at']->toIso8601String(),
            'must_change_password' => $result['user']->must_change_password,
            'user' => new UserResource($result['user']),
        ]);
    }

    public function refresh(Request $request, AuthService $authService): JsonResponse
    {
        $this->authorize('refreshToken', $request->user());

        $result = $authService->refresh($request->user());

        return response()->json([
            'token' => $result['token'],
            'token_type' => 'Bearer',
            'expires_at' => $result['expires_at']->toIso8601String(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $this->authorize('viewMe', $request->user());

        $request->user()->load('role');

        return response()->json([
            'user' => new UserResource($request->user()),
        ]);
    }

    public function logout(Request $request, AuthService $authService): JsonResponse
    {
        $this->authorize('logout', $request->user());

        $authService->logout($request->user());

        return response()->json([
            'message' => 'Sesión cerrada.',
        ]);
    }

    public function changePassword(ChangePasswordRequest $request, AuthService $authService): JsonResponse
    {
        $this->authorize('changePassword', $request->user());

        $authService->changePassword($request->user(), $request->validated('password'));

        return response()->json([
            'message' => 'Contraseña actualizada.',
            'user' => new UserResource($request->user()->load('role')),
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request, AuthService $authService): JsonResponse
    {
        $authService->sendResetLink($request->validated('email'));

        return response()->json([
            'message' => 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request, AuthService $authService): JsonResponse
    {
        $authService->resetPassword($request->validated());

        return response()->json([
            'message' => 'Contraseña restablecida. Inicia sesión con tu nueva contraseña.',
        ]);
    }
}
