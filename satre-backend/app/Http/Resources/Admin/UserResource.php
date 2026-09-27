<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_active' => $this->is_active,
            'must_change_password' => $this->must_change_password,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'profile_id' => $this->when(
                $this->relationLoaded('teacher') && $this->relationLoaded('student'),
                fn () => $this->teacher?->id ?? $this->student?->id,
            ),
            'role' => [
                'id' => $this->role?->id,
                'slug' => $this->role?->slug,
                'name' => $this->role?->name,
            ],
        ];
    }
}
