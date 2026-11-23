<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('must_change_password')->default(true)->after('password');
            $table->timestamp('password_changed_at')->nullable()->after('must_change_password');
            $table->softDeletes();
        });

        Schema::table('students', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->index(['student_id', 'academic_period_id']);
        });

        DB::table('attendances')->where('status', 'justified')->update(['status' => 'absent_justified']);
        DB::table('attendances')->where('status', 'absent')->update(['status' => 'absent_unjustified']);

        Schema::table('grades', function (Blueprint $table) {
            $table->char('criterion', 1)->nullable()->after('evaluation_name');
            $table->date('evaluation_date')->nullable()->after('criterion');
            $table->softDeletes();
        });

        $this->convertGradesToIbScale();

        Schema::table('grades', function (Blueprint $table) {
            $table->unsignedTinyInteger('score')->change();
            $table->unsignedTinyInteger('max_score')->default(7)->change();
            $table->index(['student_id', 'course_id', 'evaluation_date']);
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->timestamp('resolved_at')->nullable()->after('status');
            $table->softDeletes();
        });

        DB::table('permission_requests')->where('status', 'pending')->update(['status' => 'pending_guardian']);

        Schema::table('permission_requests', function (Blueprint $table) {
            $table->string('status', 30)->default('pending_guardian')->change();
        });

        Schema::table('risk_predictions', function (Blueprint $table) {
            $table->unsignedBigInteger('student_feature_snapshot_id')->nullable()->change();
            $table->string('risk_level', 30)->nullable()->change();
            $table->decimal('risk_score', 5, 2)->nullable()->change();
            $table->foreignId('academic_period_id')->nullable()->after('student_id')->constrained()->restrictOnDelete();
            $table->json('factors')->nullable()->after('risk_score');
            $table->decimal('data_coverage', 3, 2)->nullable()->after('factors');
            $table->boolean('insufficient_data')->default(false)->after('data_coverage');
            $table->boolean('needs_human_review')->default(false)->after('insufficient_data');
            $table->text('recommendation')->nullable()->after('needs_human_review');
        });
    }

    public function down(): void
    {
        Schema::table('risk_predictions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('academic_period_id');
            $table->dropColumn(['factors', 'data_coverage', 'insufficient_data', 'needs_human_review', 'recommendation']);
            $table->decimal('risk_score', 6, 4)->nullable()->change();
            $table->string('risk_level', 30)->nullable(false)->change();
            $table->unsignedBigInteger('student_feature_snapshot_id')->nullable(false)->change();
        });

        DB::table('permission_requests')->where('status', 'pending_guardian')->update(['status' => 'pending']);

        Schema::table('permission_requests', function (Blueprint $table) {
            $table->string('status', 30)->default('pending')->change();
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn('resolved_at');
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->dropIndex(['student_id', 'course_id', 'evaluation_date']);
            $table->dropSoftDeletes();
            $table->dropColumn(['criterion', 'evaluation_date']);
            $table->decimal('score', 5, 2)->change();
            $table->decimal('max_score', 5, 2)->default(20)->change();
        });

        DB::table('attendances')->where('status', 'absent_justified')->update(['status' => 'justified']);
        DB::table('attendances')->where('status', 'absent_unjustified')->update(['status' => 'absent']);

        Schema::table('attendances', function (Blueprint $table) {
            $table->dropIndex(['student_id', 'academic_period_id']);
        });

        Schema::table('students', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['must_change_password', 'password_changed_at']);
        });
    }

    private function convertGradesToIbScale(): void
    {
        DB::table('grades')->orderBy('id')->each(function (object $grade): void {
            $max = (float) $grade->max_score;
            $score = (float) $grade->score;
            $ibScore = $max > 7
                ? (int) max(1, min(7, (int) round($score / $max * 7)))
                : (int) max(1, min(7, (int) round($score)));

            $evaluationDate = $grade->evaluation_date
                ?? ($grade->recorded_at ? substr((string) $grade->recorded_at, 0, 10) : null)
                ?? ($grade->created_at ? substr((string) $grade->created_at, 0, 10) : null);

            DB::table('grades')->where('id', $grade->id)->update([
                'score' => $ibScore,
                'max_score' => 7,
                'evaluation_date' => $evaluationDate,
            ]);
        });
    }
};
