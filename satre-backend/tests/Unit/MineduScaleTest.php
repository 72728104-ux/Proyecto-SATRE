<?php

namespace Tests\Unit;

use App\Models\Grade;
use App\Support\MineduScale;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class MineduScaleTest extends TestCase
{
    #[DataProvider('literalBoundaries')]
    public function test_numeric_to_literal_uses_official_minedu_bands(float $score, string $letter): void
    {
        $this->assertSame($letter, MineduScale::toLiteral($score));
    }

    /**
     * @return list<array{0: float, 1: string}>
     */
    public static function literalBoundaries(): array
    {
        return [
            [20.00, 'AD'],
            [18.00, 'AD'],
            [17.99, 'A'],
            [15.00, 'A'],
            [14.99, 'B'],
            [11.00, 'B'],
            [10.99, 'C'],
            [0.00, 'C'],
        ];
    }

    public function test_literal_to_numeric_uses_band_centroids(): void
    {
        $this->assertSame(19.00, MineduScale::toNumeric('AD'));
        $this->assertSame(16.00, MineduScale::toNumeric('A'));
        $this->assertSame(12.50, MineduScale::toNumeric('B'));
        $this->assertSame(5.00, MineduScale::toNumeric('C'));
        $this->assertSame(16.00, MineduScale::toNumeric(' a '));
        $this->assertSame(5.00, MineduScale::toNumeric(null));
        $this->assertSame(5.00, MineduScale::toNumeric('Z'));
    }

    public function test_centroid_roundtrip_keeps_the_same_letter(): void
    {
        foreach (MineduScale::LETTERS as $letter) {
            $this->assertSame($letter, MineduScale::toLiteral(MineduScale::toNumeric($letter)));
        }
    }

    public function test_normalize_scales_ib_seven_to_vigesimal(): void
    {
        $this->assertSame(20.00, MineduScale::normalize(7, 7));
        $this->assertSame(14.29, MineduScale::normalize(5, 7));
        $this->assertSame(16.50, MineduScale::normalize(16.5, 20));
        $this->assertNull(MineduScale::toLiteral(null));
    }

    public function test_grade_accessor_returns_literal_and_mutator_stores_numeric(): void
    {
        $grade = new Grade(['score' => 16.50, 'max_score' => 20]);
        $this->assertSame('A', $grade->literal);

        $grade->literal = 'AD';
        $this->assertEqualsWithDelta(19.00, (float) $grade->score, 0.001);
        $this->assertSame('AD', $grade->literal);
    }
}
