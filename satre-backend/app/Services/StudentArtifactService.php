<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\ReadingMaterial;
use App\Models\StudentArtifact;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class StudentArtifactService
{
    public function submit(User $studentUser, ReadingMaterial $reading, array $data): StudentArtifact
    {
        $student = $studentUser->student;

        if ($student === null) {
            throw ValidationException::withMessages([
                'nodes' => 'El usuario no tiene perfil de estudiante.',
            ]);
        }

        $enrolled = Enrollment::query()
            ->where('student_id', $student->id)
            ->where('course_id', $reading->course_id)
            ->where('status', 'active')
            ->exists();

        if (! $enrolled) {
            throw ValidationException::withMessages([
                'nodes' => 'El estudiante no está matriculado en el curso de esta lectura.',
            ]);
        }

        $artifact = StudentArtifact::query()->create([
            'reading_material_id' => $reading->id,
            'student_id' => $student->id,
            'nodes' => $data['nodes'],
            'connections' => $data['connections'],
        ]);

        return $artifact->load(['student', 'readingMaterial']);
    }
}
