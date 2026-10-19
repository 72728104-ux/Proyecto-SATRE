<?php

use App\Support\MineduScale;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->decimal('score', 4, 2)->change();
            $table->decimal('max_score', 4, 2)->default(MineduScale::MAX)->change();
        });

        $this->convertIbScoresToVigesimal();
    }

    public function down(): void
    {
        DB::table('grades')->orderBy('id')->each(function (object $grade): void {
            $max = (float) $grade->max_score;
            $score = (float) $grade->score;
            $ib = $max > 0
                ? (int) max(1, min(7, (int) round($score / $max * 7)))
                : (int) max(1, min(7, (int) round($score)));

            DB::table('grades')->where('id', $grade->id)->update([
                'score' => $ib,
                'max_score' => 7,
            ]);
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->unsignedTinyInteger('score')->change();
            $table->unsignedTinyInteger('max_score')->default(7)->change();
        });
    }

    private function convertIbScoresToVigesimal(): void
    {
        DB::table('grades')->orderBy('id')->each(function (object $grade): void {
            $max = (float) $grade->max_score;
            $score = MineduScale::normalize($grade->score, $max > 0 ? $max : 7);

            DB::table('grades')->where('id', $grade->id)->update([
                'score' => $score ?? MineduScale::MIN,
                'max_score' => MineduScale::MAX,
            ]);
        });
    }
};
