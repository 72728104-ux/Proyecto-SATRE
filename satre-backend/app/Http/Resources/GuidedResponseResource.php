<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GuidedResponseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'guided_question_id' => $this->guided_question_id,
            'student_id' => $this->student_id,
            'response' => $this->response,
            'is_correct' => $this->is_correct,
            'feedback' => $this->feedback,
        ];
    }
}
