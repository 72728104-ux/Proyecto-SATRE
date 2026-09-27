<?php

namespace App\Services;

use App\Events\PermissionApproved;
use App\Models\PermissionRequest;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class PermissionRequestService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function request(User $studentUser, array $data): PermissionRequest
    {
        $permission = PermissionRequest::query()->create([
            'student_id' => $studentUser->student->id,
            'requested_by' => $studentUser->id,
            'type' => $data['type'],
            'reason' => $data['reason'],
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'],
            'status' => PermissionRequest::STATUS_PENDING_GUARDIAN,
        ]);

        $this->auditLogger->record($studentUser, 'permission.requested', $permission, [], $permission->toArray());

        return $permission->load('student');
    }

    public function respondAsGuardian(User $guardianUser, PermissionRequest $permission, string $decision): PermissionRequest
    {
        $this->ensureStatus($permission, [PermissionRequest::STATUS_PENDING_GUARDIAN]);

        return $this->transition($guardianUser, $permission, 'permission.guardian_responded', [
            'status' => $decision === 'approved' ? PermissionRequest::STATUS_APPROVED_GUARDIAN : PermissionRequest::STATUS_REJECTED,
            'guardian_id' => $guardianUser->guardian->id,
        ]);
    }

    public function resolve(User $reviewer, PermissionRequest $permission, string $decision): PermissionRequest
    {
        $this->ensureStatus($permission, $decision === 'approved'
            ? [PermissionRequest::STATUS_APPROVED_GUARDIAN]
            : [PermissionRequest::STATUS_PENDING_GUARDIAN, PermissionRequest::STATUS_APPROVED_GUARDIAN]);

        $permission = $this->transition($reviewer, $permission, 'permission.resolved', [
            'status' => $decision === 'approved' ? PermissionRequest::STATUS_APPROVED : PermissionRequest::STATUS_REJECTED,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        if ($permission->status === PermissionRequest::STATUS_APPROVED) {
            PermissionApproved::dispatch($permission);
        }

        return $permission;
    }

    /**
     * @param  list<string>  $allowed
     */
    private function ensureStatus(PermissionRequest $permission, array $allowed): void
    {
        if (! in_array($permission->status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => "La solicitud no puede cambiar desde el estado {$permission->status}.",
            ]);
        }
    }

    private function transition(User $user, PermissionRequest $permission, string $action, array $attributes): PermissionRequest
    {
        $permission->fill($attributes);
        $oldValues = array_intersect_key($permission->getRawOriginal(), $permission->getDirty());
        $permission->save();

        $this->auditLogger->record($user, $action, $permission, $oldValues, Arr::except($permission->getChanges(), 'updated_at'));

        return $permission->load('student');
    }
}
