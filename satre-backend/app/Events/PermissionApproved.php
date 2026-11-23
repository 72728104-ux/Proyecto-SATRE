<?php

namespace App\Events;

use App\Models\PermissionRequest;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PermissionApproved
{
    use Dispatchable, SerializesModels;

    public function __construct(public PermissionRequest $permissionRequest) {}
}
