<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('student_feature_snapshots')) {
            Schema::create('student_feature_snapshots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained()->restrictOnDelete();
                $table->foreignId('academic_period_id')->constrained()->restrictOnDelete();
                $table->timestamp('snapshot_at');
                $table->decimal('attendance_rate', 5, 4)->nullable();
                $table->decimal('residential_presence_rate', 5, 4)->nullable();
                $table->decimal('academic_average', 5, 2)->nullable();
                $table->unsignedSmallInteger('failed_courses')->default(0);
                $table->decimal('academic_trend', 5, 4)->nullable();
                $table->unsignedSmallInteger('incident_count')->default(0);
                $table->decimal('tardiness_rate', 5, 4)->nullable();
                $table->json('extra_features')->nullable();
                $table->string('generated_by', 80)->default('feature_consolidation');
                $table->timestamps();
                $table->index(['student_id', 'academic_period_id', 'snapshot_at'], 'sfs_student_period_at_idx');
            });
        }

        if (! Schema::hasTable('risk_predictions')) {
            Schema::create('risk_predictions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained()->restrictOnDelete();
                $table->foreignId('student_feature_snapshot_id')->constrained()->restrictOnDelete();
                $table->string('risk_level', 30);
                $table->decimal('risk_score', 6, 4)->nullable();
                $table->string('model_version', 50)->nullable();
                $table->timestamp('predicted_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('risk_explanations')) {
            Schema::create('risk_explanations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('risk_prediction_id')->constrained()->cascadeOnDelete();
                $table->string('method', 50);
                $table->json('explanation_payload');
                $table->timestamp('generated_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('alerts')) {
            Schema::create('alerts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained()->restrictOnDelete();
                $table->foreignId('risk_prediction_id')->nullable()->constrained()->nullOnDelete();
                $table->string('type', 80);
                $table->string('severity', 30);
                $table->string('title');
                $table->text('message');
                $table->string('status', 30)->default('open');
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('interventions')) {
            Schema::create('interventions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('alert_id')->constrained()->restrictOnDelete();
                $table->foreignId('student_id')->constrained()->restrictOnDelete();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->string('type', 80);
                $table->text('description');
                $table->string('status', 30)->default('planned');
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('follow_ups')) {
            Schema::create('follow_ups', function (Blueprint $table) {
                $table->id();
                $table->foreignId('intervention_id')->constrained()->restrictOnDelete();
                $table->foreignId('student_id')->constrained()->restrictOnDelete();
                $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
                $table->date('follow_up_date');
                $table->string('outcome', 80)->nullable();
                $table->text('notes');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('interventions');
        Schema::dropIfExists('alerts');
        Schema::dropIfExists('risk_explanations');
        Schema::dropIfExists('risk_predictions');
        Schema::dropIfExists('student_feature_snapshots');
    }
};
