<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Resources\Admin\UserResource;
use App\Models\User;
use App\Services\Admin\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        $users = User::query()
            ->with(['role', 'teacher:id,user_id', 'student:id,user_id'])
            ->when($request->string('role')->toString(), fn ($query, $role) => $query->whereRelation('role', 'slug', $role))
            ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->string('search')->trim()->toString(), fn ($query, $search) => $query->where(
                fn ($query) => $query->where('name', 'like', "%$search%")->orWhere('email', 'like', "%$search%")
            ))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return UserResource::collection($users);
    }

    public function show(User $user): UserResource
    {
        $this->authorize('view', $user);

        return new UserResource($user->load('role'));
    }

    public function store(StoreUserRequest $request, UserService $userService): JsonResponse
    {
        $this->authorize('create', User::class);

        $result = $userService->create($request->user(), $request->validated());

        return (new UserResource($result['user']))
            ->additional(['temporary_password' => $result['temporary_password']])
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateUserRequest $request, User $user, UserService $userService): UserResource
    {
        $this->authorize('update', $user);

        return new UserResource($userService->update($request->user(), $user, $request->validated()));
    }

    public function destroy(Request $request, User $user, UserService $userService): JsonResponse
    {
        $this->authorize('delete', $user);

        $userService->delete($request->user(), $user);

        return response()->json(['message' => 'Usuario eliminado.']);
    }

    public function toggleActive(Request $request, User $user, UserService $userService): JsonResponse
    {
        $this->authorize('toggleActive', $user);

        $user = $userService->toggleActive($request->user(), $user);

        return response()->json([
            'message' => $user->is_active ? 'Usuario activado.' : 'Usuario desactivado.',
            'data' => new UserResource($user),
        ]);
    }

    public function resetPassword(Request $request, User $user, UserService $userService): JsonResponse
    {
        $this->authorize('resetPassword', $user);

        $temporaryPassword = $userService->resetPassword($request->user(), $user);

        return response()->json([
            'message' => 'Contraseña restablecida. El usuario deberá cambiarla al iniciar sesión.',
            'temporary_password' => $temporaryPassword,
            'data' => new UserResource($user->load('role')),
        ]);
    }
}
