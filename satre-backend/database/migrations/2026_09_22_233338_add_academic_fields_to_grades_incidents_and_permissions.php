<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->unsignedTinyInteger('score')->change();
            $table->unsignedTinyInteger('max_score')->default(7)->change();
            $table->char('criterion', 1)->nullable()->after('evaluation_name');
            $table->date('evaluation_date')->nullable()->after('criterion');
            $table->index(['student_id', 'course_id', 'evaluation_date']);
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->timestamp('resolved_at')->nullable()->after('status');
        });

        Schema::table('permission_requests', function (Blueprint $table) {
            $table->string('status', 30)->default('pending_guardian')->change();
        });

        DB::table('permission_requests')->where('status', 'pending')->update(['status' => 'pending_guardian']);
    }

    public function down(): void
    {
        DB::table('permission_requests')->where('status', 'pending_guardian')->update(['status' => 'pending']);

        Schema::table('permission_requests', function (Blueprint $table) {
            $table->string('status', 30)->default('pending')->change();
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn('resolved_at');
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->dropIndex(['student_id', 'course_id', 'evaluation_date']);
            $table->dropColumn(['criterion', 'evaluation_date']);
            $table->decimal('score', 5, 2)->change();
            $table->decimal('max_score', 5, 2)->default(20)->change();
        });
    }
};
