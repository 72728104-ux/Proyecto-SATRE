<?php

namespace App\Http\Controllers;

use App\Http\Requests\IndexResidentsRequest;
use App\Http\Resources\ResidentResource;
use App\Models\Student;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ResidentController extends Controller
{
    /**
     * Internos activos. Con `presence_date`, cada fila trae su presencia de ese control (`check_type`, por defecto night).
     */
    public function index(IndexResidentsRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewResidents', Student::class);
        $filters = $request->validated();
        $search = $filters['search'] ?? null;

        $residents = Student::query()
            ->where('is_boarder', true)
            ->where('status', 'active')
            ->with('classroom')
            ->when($filters['presence_date'] ?? null, fn ($query, $date) => $query->with([
                'residentialPresences' => fn ($presences) => $presences
                    ->whereDate('presence_date', $date)
                    ->where('check_type', $filters['check_type'] ?? 'night'),
            ]))
            ->when($search, fn ($query) => $query->where(fn ($match) => $match
                ->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('student_code', 'like', "%{$search}%")))
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate(15)
            ->withQueryString();

        return ResidentResource::collection($residents);
    }
}
