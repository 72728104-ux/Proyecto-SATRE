<?php

namespace App\Services;

use App\Models\ReadingMaterial;
use App\Models\User;
use Illuminate\Support\Arr;

class ReadingService
{
    public function create(User $teacher, array $data): ReadingMaterial
    {
        $reading = ReadingMaterial::query()->create([
            'course_id' => $data['course_id'],
            'title' => $data['title'],
            'criterion' => $data['criterion'] ?? null,
            'content' => $data['content'] ?? null,
            'url' => $data['url'] ?? null,
            'created_by' => $teacher->id,
        ]);

        return $reading->load(['course', 'creator']);
    }

    public function update(ReadingMaterial $reading, array $data): ReadingMaterial
    {
        $reading->fill(Arr::only($data, ['title', 'criterion', 'content', 'url']));
        $reading->save();

        return $reading->load(['course', 'creator']);
    }
}
