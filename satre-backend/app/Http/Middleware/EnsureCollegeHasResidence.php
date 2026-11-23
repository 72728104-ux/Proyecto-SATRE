<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCollegeHasResidence
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('app.college_has_residence')) {
            abort(404, 'El módulo de residencia no está habilitado para este colegio.');
        }

        return $next($request);
    }
}
