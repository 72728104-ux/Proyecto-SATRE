<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reading_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->restrictOnDelete();
            $table->string('title');
            $table->char('criterion', 1)->nullable();
            $table->text('content')->nullable();
            $table->string('url')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('student_artifacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reading_material_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->json('nodes');
            $table->json('connections');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('guided_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reading_material_id')->constrained()->restrictOnDelete();
            $table->text('prompt');
            $table->string('type', 30);
            $table->json('options')->nullable();
            $table->text('correct_answer');
            $table->timestamps();
        });

        Schema::create('guided_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guided_question_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->text('response');
            $table->boolean('is_correct');
            $table->timestamps();
        });

        Schema::create('quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reading_material_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->decimal('score', 5, 2);
            $table->unsignedSmallInteger('total_questions');
            $table->unsignedSmallInteger('correct_count');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('guided_responses');
        Schema::dropIfExists('guided_questions');
        Schema::dropIfExists('student_artifacts');
        Schema::dropIfExists('reading_materials');
    }
};
