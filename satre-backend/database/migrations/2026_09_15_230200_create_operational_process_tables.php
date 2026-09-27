<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('course_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_period_id')->constrained()->restrictOnDelete();
            $table->date('attendance_date');
            $table->string('status', 30);
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->string('notes', 500)->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'course_id', 'attendance_date']);
        });

        Schema::create('grades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('course_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_period_id')->constrained()->restrictOnDelete();
            $table->string('evaluation_name');
            $table->decimal('score', 5, 2);
            $table->decimal('max_score', 5, 2)->default(20);
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('residential_presences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->date('presence_date');
            $table->string('check_type', 30);
            $table->string('status', 30);
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->string('notes', 500)->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'presence_date', 'check_type']);
        });

        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('reported_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('incident_at');
            $table->string('category', 80);
            $table->string('severity', 30);
            $table->text('description');
            $table->string('status', 30)->default('open');
            $table->timestamps();
        });

        Schema::create('permission_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('guardian_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 50);
            $table->text('reason');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status', 30)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_requests');
        Schema::dropIfExists('incidents');
        Schema::dropIfExists('residential_presences');
        Schema::dropIfExists('grades');
        Schema::dropIfExists('attendances');
    }
};
