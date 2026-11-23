<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_periods', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_current')->default(false);
            $table->timestamps();
        });

        Schema::create('teachers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->string('employee_code', 30)->unique();
            $table->string('specialty')->nullable();
            $table->timestamps();
        });

        Schema::create('monitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->string('employee_code', 30)->unique();
            $table->timestamps();
        });

        Schema::create('guardians', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('document_number', 20)->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
        });

        Schema::create('classrooms', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('grade_level', 30);
            $table->unsignedSmallInteger('capacity')->nullable();
            $table->foreignId('academic_period_id')->constrained()->restrictOnDelete();
            $table->foreignId('tutor_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('student_code', 30)->unique();
            $table->string('document_number', 20)->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('status', 30)->default('active');
            $table->boolean('is_boarder')->default(true);
            $table->foreignId('classroom_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('guardian_student', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guardian_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('relationship', 50)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->unique(['guardian_id', 'student_id']);
        });

        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30);
            $table->string('name');
            $table->foreignId('classroom_id')->constrained()->restrictOnDelete();
            $table->foreignId('teacher_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_period_id')->constrained()->restrictOnDelete();
            $table->timestamps();
            $table->unique(['code', 'academic_period_id']);
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('course_id')->constrained()->restrictOnDelete();
            $table->string('status', 30)->default('active');
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'course_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('guardian_student');
        Schema::dropIfExists('students');
        Schema::dropIfExists('classrooms');
        Schema::dropIfExists('guardians');
        Schema::dropIfExists('monitors');
        Schema::dropIfExists('teachers');
        Schema::dropIfExists('academic_periods');
    }
};
