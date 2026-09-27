<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tutor_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('course_id')->constrained()->restrictOnDelete();
            $table->string('topic', 150);
            $table->char('criterion', 1)->nullable();
            // Estado opaco de la máquina socrática de satre-analytics; se reenvía en cada turno.
            $table->json('state')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->index(['student_id', 'updated_at']);
        });

        Schema::create('tutor_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tutor_session_id')->constrained()->restrictOnDelete();
            $table->string('role', 10);
            $table->text('content');
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_messages');
        Schema::dropIfExists('tutor_sessions');
    }
};
