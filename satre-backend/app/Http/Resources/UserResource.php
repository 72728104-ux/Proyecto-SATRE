<?php

namespace App\Http\Resources;

use App\Support\Roles;
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
            'role' => [
                'id' => $this->role?->id,
                'slug' => $this->role?->slug,
                'name' => $this->role?->name,
            ],
            'students' => $this->when($this->hasRole(Roles::GUARDIAN), function () {
                $this->loadMissing('guardian.students.classroom');

                return ($this->guardian?->students ?? collect())
                    ->map(fn ($student) => [
                        'id' => $student->id,
                        'student_code' => $student->student_code,
                        'name' => trim($student->first_name.' '.$student->last_name),
                        'classroom' => $student->classroom?->name,
                    ])
                    ->values();
            }),
        ];
    }
}
