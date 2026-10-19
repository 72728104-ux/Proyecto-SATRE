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
            $table->string('dni', 8)->nullable()->unique()->after('email');
        });

        Schema::table('students', function (Blueprint $table) {
            $table->string('dni', 8)->nullable()->unique()->after('document_number');
        });

        Schema::table('teachers', function (Blueprint $table) {
            $table->string('dni', 8)->nullable()->unique()->after('employee_code');
        });

        $this->backfillStudentDni();
    }

    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropUnique(['dni']);
            $table->dropColumn('dni');
        });

        Schema::table('students', function (Blueprint $table) {
            $table->dropUnique(['dni']);
            $table->dropColumn('dni');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['dni']);
            $table->dropColumn('dni');
        });
    }

    private function backfillStudentDni(): void
    {
        foreach (DB::table('students')->orderBy('id')->get() as $student) {
            $dni = (string) $student->document_number;
            if (! preg_match('/^\d{8}$/', $dni)) {
                continue;
            }

            DB::table('students')->where('id', $student->id)->update(['dni' => $dni]);

            if ($student->user_id) {
                DB::table('users')->where('id', $student->user_id)->whereNull('dni')->update(['dni' => $dni]);
            }
        }
    }
};
