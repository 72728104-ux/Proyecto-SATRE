<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\IndexAuditLogRequest;
use App\Http\Resources\Admin\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    public function index(IndexAuditLogRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', AuditLog::class);

        $filters = $request->validated();

        $logs = AuditLog::query()
            ->with('user')
            ->when($filters['user_id'] ?? null, fn ($query, $userId) => $query->where('user_id', $userId))
            ->when($filters['action'] ?? null, fn ($query, $action) => $query->where('action', 'like', $action.'%'))
            ->when($filters['date_from'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return AuditLogResource::collection($logs);
    }
}
