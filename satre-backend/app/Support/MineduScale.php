<?php

namespace App\Support;

/**
 * Escala oficial Minedu (TOBE-4): vigesimal 0.00–20.00 ↔ literal AD/A/B/C.
 */
final class MineduScale
{
    public const MIN = 0.0;

    public const MAX = 20.0;

    public const PASSING = 11.0;

    public const AD = 'AD';

    public const A = 'A';

    public const B = 'B';

    public const C = 'C';

    /** @var list<string> */
    public const LETTERS = [self::AD, self::A, self::B, self::C];

    public const AD_MIN = 18.0;

    public const A_MIN = 15.0;

    public const B_MIN = 11.0;

    /** Representante central de cada banda, para el mutador literal → numérico. */
    public const CENTROIDS = [
        self::AD => 19.00,
        self::A => 16.00,
        self::B => 12.50,
        self::C => 5.00,
    ];

    public static function toLiteral(mixed $score): ?string
    {
        if ($score === null || $score === '') {
            return null;
        }

        if (! is_numeric($score)) {
            return null;
        }

        $value = (float) $score;
        if ($value >= self::AD_MIN) {
            return self::AD;
        }
        if ($value >= self::A_MIN) {
            return self::A;
        }
        if ($value >= self::B_MIN) {
            return self::B;
        }

        return self::C;
    }

    public static function toNumeric(mixed $letter): float
    {
        if ($letter === null || $letter === '') {
            return self::CENTROIDS[self::C];
        }

        $key = strtoupper(trim((string) $letter));

        return self::CENTROIDS[$key] ?? self::CENTROIDS[self::C];
    }

    public static function normalize(mixed $score, mixed $maxScore = self::MAX): ?float
    {
        if ($score === null || $score === '' || ! is_numeric($score)) {
            return null;
        }

        $max = is_numeric($maxScore) ? (float) $maxScore : self::MAX;
        if ($max <= 0) {
            $max = self::MAX;
        }

        $scaled = ((float) $score) * self::MAX / $max;

        return round(max(self::MIN, min(self::MAX, $scaled)), 2);
    }
}
