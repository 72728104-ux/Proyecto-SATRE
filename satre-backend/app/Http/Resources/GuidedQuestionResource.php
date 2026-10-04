<?php

namespace App\Http\Resources;

use App\Support\Roles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GuidedQuestionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $staff = $request->user()?->hasRole(Roles::ADMIN, Roles::TEACHER) ?? false;
        $own = $this->whenLoaded('responses') ? $this->responses->first() : null;

        return [
            'id' => $this->id,
            'reading_material_id' => $this->reading_material_id,
            'prompt' => $this->prompt,
            'type' => $this->type,
            'options' => $this->options,
            'correct_answer' => $this->when($staff, $this->correct_answer),
            'aggregates' => $this->when($staff, [
                'response_count' => (int) ($this->responses_count ?? 0),
                'correct_count' => (int) ($this->correct_responses_count ?? 0),
            ]),
            'my_response' => $this->when(
                $request->user()?->hasRole(Roles::STUDENT) === true,
                $own === null ? null : [
                    'response' => $own->response,
                    'is_correct' => $own->is_correct,
                ]
            ),
        ];
    }
}
