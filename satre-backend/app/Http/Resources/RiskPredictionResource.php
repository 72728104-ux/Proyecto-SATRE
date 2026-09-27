<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RiskPredictionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $reduced = [
            'student_id' => $this->student_id,
            'risk_level' => $this->risk_level,
            'recommendation' => $this->recommendation,
            'predicted_at' => $this->predicted_at?->toIso8601String(),
        ];

        if (! $request->user()->can('viewRiskDetail', $this->student)) {
            return $reduced;
        }

        return $reduced + [
            'id' => $this->id,
            'academic_period_id' => $this->academic_period_id,
            'risk_score' => $this->risk_score !== null ? (float) $this->risk_score : null,
            'factors' => $this->factors ?? [],
            'data_coverage' => $this->data_coverage !== null ? (float) $this->data_coverage : null,
            'insufficient_data' => $this->insufficient_data,
            'needs_human_review' => $this->needs_human_review,
            'model_version' => $this->model_version,
        ];
    }
}
