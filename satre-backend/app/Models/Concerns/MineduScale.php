<?php

namespace App\Models\Concerns;

use App\Support\MineduScale as MineduLetters;
use Illuminate\Database\Eloquent\Casts\Attribute;

/**
 * Accesores/mutadores entre nota vigesimal (BD) y letra Minedu (API).
 */
trait MineduScale
{
    protected function literal(): Attribute
    {
        return Attribute::make(
            get: fn (): ?string => MineduLetters::toLiteral($this->score),
            set: fn (mixed $letter): array => [
                'score' => MineduLetters::toNumeric($letter),
            ],
        );
    }
}
