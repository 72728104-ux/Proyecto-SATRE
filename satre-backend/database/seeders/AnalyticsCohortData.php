<?php

namespace Database\Seeders;

use App\Exceptions\SeederDataException;
use Faker\Generator;
use Illuminate\Support\Carbon;

/**
 * Cálculos deterministas de calendario y reparto usados por AnalyticsCohortSeeder.
 */
final class AnalyticsCohortData
{
    /**
     * @return list<array{profile: string, ordinal: int}>
     */
    public static function cohortPlan(): array
    {
        $plan = [];

        foreach (['BAJO' => 10, 'MEDIO' => 9, 'ALTO' => 7, 'INSUFICIENTE' => 4] as $profile => $count) {
            for ($ordinal = 0; $ordinal < $count; $ordinal++) {
                $plan[] = ['profile' => $profile, 'ordinal' => $ordinal];
            }
        }

        return $plan;
    }

    /**
     * @return list<string>
     */
    public static function datesBetween(Carbon $start, Carbon $end, ?int $isoWeekday): array
    {
        $dates = [];

        for ($day = $start->copy()->startOfDay(); $day->lte($end); $day->addDay()) {
            if ($day->isWeekend()) {
                continue;
            }

            if ($isoWeekday !== null && (int) $day->dayOfWeekIso !== $isoWeekday) {
                continue;
            }

            $dates[] = $day->toDateString();
        }

        return $dates;
    }

    /**
     * @param  list<string>  $dates
     * @return list<string>
     */
    public static function pickDates(array $dates, int $count, int $offset): array
    {
        $total = count($dates);

        if ($total < $count) {
            throw new SeederDataException('El periodo académico actual no tiene suficientes días hábiles para la cohorte de analítica.');
        }

        $offset %= $total;
        $rotated = array_merge(array_slice($dates, $offset), array_slice($dates, 0, $offset));
        $step = $total / $count;
        $picked = [];

        for ($i = 0; $i < $count; $i++) {
            $picked[] = $rotated[min($total - 1, (int) floor($i * $step))];
        }

        sort($picked);

        if (count(array_unique($picked)) !== $count) {
            throw new SeederDataException('No se pudieron elegir fechas distintas dentro del periodo académico actual.');
        }

        return $picked;
    }

    /**
     * @return list<int>
     */
    public static function quota(int $total, int $buckets, int $shift): array
    {
        $parts = array_fill(0, $buckets, intdiv($total, $buckets));

        for ($i = 0; $i < $total % $buckets; $i++) {
            $parts[($shift + $i) % $buckets]++;
        }

        return $parts;
    }

    /**
     * @return list<array{course: int, criterion: string, round: int, score: int}>
     */
    public static function gradeSpecs(string $profile, int $ordinal): array
    {
        $specs = self::flattenGradeMatrix(self::gradeMatrix($profile, $ordinal));

        return $profile === 'ALTO' ? self::thinAdvancedGradeSpecs($specs, $ordinal) : $specs;
    }

    /**
     * @return array<int, array<string, array{0: int, 1: int}>>
     */
    private static function gradeMatrix(string $profile, int $ordinal): array
    {
        $lead = $ordinal % 2 === 1 ? [4, 4] : [5, 3];

        return match ($profile) {
            'BAJO' => self::bajoMatrix($ordinal),
            // Una sola brecha por curso (promedio < 4): C en MAT, D en BIO, B en LEN.
            'MEDIO' => [
                0 => ['A' => $lead, 'B' => [4, 4], 'C' => [3, 3], 'D' => [4, 4]],
                1 => ['A' => $lead, 'B' => [4, 4], 'C' => [4, 4], 'D' => [3, 3]],
                2 => ['A' => $lead, 'B' => [3, 3], 'C' => [4, 4], 'D' => [4, 4]],
            ],
            default => [
                0 => ['A' => [4, 3], 'B' => [3, 2], 'C' => [2, 1], 'D' => [3, 2]],
                1 => ['A' => [4, 3], 'B' => [3, 2], 'C' => [3, 2], 'D' => [2, 1]],
                2 => ['A' => [4, 3], 'B' => [2, 1], 'C' => [3, 2], 'D' => [3, 2]],
            ],
        };
    }

    /**
     * @param  array<int, array<string, array{0: int, 1: int}>>  $matrix
     * @return list<array{course: int, criterion: string, round: int, score: int}>
     */
    private static function flattenGradeMatrix(array $matrix): array
    {
        $specs = [];

        foreach ($matrix as $courseIndex => $criteria) {
            foreach ($criteria as $criterion => $rounds) {
                foreach ($rounds as $roundIndex => $score) {
                    $specs[] = [
                        'course' => $courseIndex,
                        'criterion' => $criterion,
                        'round' => $roundIndex + 1,
                        'score' => $score,
                    ];
                }
            }
        }

        return $specs;
    }

    /**
     * @param  list<array{course: int, criterion: string, round: int, score: int}>  $specs
     * @return list<array{course: int, criterion: string, round: int, score: int}>
     */
    private static function thinAdvancedGradeSpecs(array $specs, int $ordinal): array
    {
        $missingCourse = $ordinal % 3;
        $missingCriterion = ['A', 'B', 'C', 'D'][$ordinal % 4];
        $nudged = false;
        $filtered = [];

        foreach ($specs as $spec) {
            if ($spec['course'] === $missingCourse && $spec['criterion'] === $missingCriterion) {
                continue;
            }

            if (! $nudged && $ordinal % 2 === 1 && $spec['score'] === 3) {
                $spec['score'] = 2;
                $nudged = true;
            }

            $filtered[] = $spec;
        }

        usort($filtered, function (array $a, array $b): int {
            return $b['score'] <=> $a['score']
                ?: $a['course'] <=> $b['course']
                ?: strcmp($a['criterion'], $b['criterion']);
        });

        return $filtered;
    }

    /**
     * @return array<int, array<string, array{0: int, 1: int}>>
     */
    private static function bajoMatrix(int $ordinal): array
    {
        $patterns = [
            ['A' => [6, 7], 'B' => [6, 6], 'C' => [7, 6], 'D' => [5, 6]],
            ['A' => [7, 6], 'B' => [5, 6], 'C' => [6, 7], 'D' => [6, 6]],
            ['A' => [6, 6], 'B' => [7, 5], 'C' => [6, 6], 'D' => [7, 6]],
        ];

        return [
            0 => $patterns[$ordinal % 3],
            1 => $patterns[($ordinal + 1) % 3],
            2 => $patterns[($ordinal + 2) % 3],
        ];
    }

    /**
     * @template T
     *
     * @param  list<T>  $items
     * @return list<T>
     */
    public static function permute(array $items, Generator $faker): array
    {
        $items = array_values($items);

        for ($i = count($items) - 1; $i > 0; $i--) {
            $j = $faker->numberBetween(0, $i);
            [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
        }

        return $items;
    }
}
