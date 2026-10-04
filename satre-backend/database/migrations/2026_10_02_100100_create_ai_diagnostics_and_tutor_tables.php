<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
        });

        Schema::create('tutor_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('course_id')->constrained()->restrictOnDelete();
            $table->string('topic');
            $table->char('criterion', 1)->nullable();
            $table->json('state')->nullable();
            $table->string('status', 30);
            $table->timestamps();
        });

        Schema::create('tutor_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tutor_session_id')->constrained()->restrictOnDelete();
            $table->string('role', 20);
            $table->text('content');
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_messages');
        Schema::dropIfExists('tutor_sessions');
        Schema::dropIfExists('ai_diagnostics');
    }
};
