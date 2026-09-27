<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('risk_predictions', function (Blueprint $table) {
            // Python lee MySQL directo (D1/D2): ya no hay snapshot ni nivel cuando faltan datos.
            $table->unsignedBigInteger('student_feature_snapshot_id')->nullable()->change();
            $table->string('risk_level', 30)->nullable()->change();
            $table->decimal('risk_score', 5, 2)->nullable()->change();
            $table->foreignId('academic_period_id')->nullable()->after('student_id')->constrained()->restrictOnDelete();
            $table->json('factors')->nullable()->after('risk_score');
            $table->decimal('data_coverage', 3, 2)->nullable()->after('factors');
            $table->boolean('insufficient_data')->default(false)->after('data_coverage');
            $table->boolean('needs_human_review')->default(false)->after('insufficient_data');
            $table->text('recommendation')->nullable()->after('needs_human_review');
            $table->index(['student_id', 'predicted_at']);
        });

        Schema::table('alerts', function (Blueprint $table) {
            $table->index(['student_id', 'status']);
        });

        Schema::create('ai_diagnostics', function (Blueprint $table) {
            $table->id();
            $table->string('type', 30);
            $table->foreignId('student_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('classroom_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('academic_period_id')->constrained()->restrictOnDelete();
            $table->json('payload');
            $table->string('model_version', 50)->nullable();
            $table->boolean('insufficient_data')->default(false);
            $table->timestamp('generated_at');
            $table->timestamps();
            $table->index(['type', 'classroom_id', 'academic_period_id']);
            $table->index(['type', 'student_id', 'academic_period_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_diagnostics');

        Schema::table('alerts', function (Blueprint $table) {
            $table->dropIndex(['student_id', 'status']);
        });

        Schema::table('risk_predictions', function (Blueprint $table) {
            $table->dropIndex(['student_id', 'predicted_at']);
            $table->dropConstrainedForeignId('academic_period_id');
            $table->dropColumn(['factors', 'data_coverage', 'insufficient_data', 'needs_human_review', 'recommendation']);
            $table->decimal('risk_score', 6, 4)->nullable()->change();
            $table->string('risk_level', 30)->nullable(false)->change();
            $table->unsignedBigInteger('student_feature_snapshot_id')->nullable(false)->change();
        });
    }
};
