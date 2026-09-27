<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\AlertController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\MeSummaryController;
use App\Http\Controllers\PermissionRequestController;
use App\Http\Controllers\ResidentController;
use App\Http\Controllers\ResidentialPresenceController;
use App\Http\Controllers\SocraticTutorController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'name' => config('app.name'),
        'status' => 'ok',
    ]);
});

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:forgot-password');
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
        Route::post('/register', [Admin\UserController::class, 'store'])->middleware(['role:admin', 'password.changed']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/courses', [CourseController::class, 'index']);
    Route::get('/courses/{course}/attendance-session', [CourseController::class, 'attendanceSession']);
    Route::get('/attendances', [AttendanceController::class, 'index']);
    Route::post('/attendances/session', [AttendanceController::class, 'storeSession']);
    Route::post('/attendances', [AttendanceController::class, 'store']);
});

Route::middleware(['auth:sanctum', 'password.changed'])->group(function () {
    Route::get('/grades', [GradeController::class, 'index'])->middleware('role:admin,teacher,student');
    Route::post('/grades', [GradeController::class, 'store'])->middleware('role:teacher');
    Route::put('/grades/{grade}', [GradeController::class, 'update'])->middleware('role:teacher');

    Route::get('/presences', [ResidentialPresenceController::class, 'index'])->middleware('role:admin,monitor,student');
    Route::post('/presences', [ResidentialPresenceController::class, 'store'])->middleware('role:monitor');
    Route::post('/presences/bulk', [ResidentialPresenceController::class, 'storeBulk'])->middleware('role:monitor');
    Route::get('/residents', [ResidentController::class, 'index'])->middleware('role:admin,monitor');
    Route::put('/presences/{presence}', [ResidentialPresenceController::class, 'update'])->middleware('role:monitor');

    Route::get('/incidents', [IncidentController::class, 'index'])->middleware('role:admin,monitor,teacher,guardian');
    Route::post('/incidents', [IncidentController::class, 'store'])->middleware('role:monitor');
    Route::put('/incidents/{incident}', [IncidentController::class, 'update'])->middleware('role:monitor');

    Route::get('/permissions', [PermissionRequestController::class, 'index'])->middleware('role:admin,monitor,student,guardian');
    Route::post('/permissions', [PermissionRequestController::class, 'store'])->middleware('role:student');
    Route::patch('/permissions/{permission}/guardian', [PermissionRequestController::class, 'respondAsGuardian'])->middleware('role:guardian');
    Route::patch('/permissions/{permission}/resolve', [PermissionRequestController::class, 'resolve'])->middleware('role:admin,monitor');

    Route::get('/me/summary', [MeSummaryController::class, 'show'])->middleware('role:student,guardian');

    Route::get('/alerts', [AlertController::class, 'index'])->middleware('role:admin,teacher,monitor,student,guardian');
    Route::patch('/alerts/{alert}', [AlertController::class, 'update'])->middleware('role:admin,teacher,monitor');
    Route::post('/alerts/{alert}/interventions', [AlertController::class, 'storeIntervention'])->middleware('role:admin,teacher,monitor');
    Route::post('/interventions/{intervention}/follow-ups', [AlertController::class, 'storeFollowUp'])->middleware('role:admin,teacher,monitor');

    Route::prefix('ai-analytics')->group(function () {
        Route::get('/teacher/insights/{classroom}', [AnalyticsController::class, 'teacherInsights'])->middleware('role:admin,teacher');
        Route::get('/students/{student}/risk', [AnalyticsController::class, 'studentRisk'])->middleware('role:admin,teacher,monitor,student,guardian');
        Route::post('/student/socratic-tutor', [SocraticTutorController::class, 'store'])->middleware(['role:student', 'throttle:60,1']);
        Route::get('/student/socratic-tutor/sessions', [SocraticTutorController::class, 'index'])->middleware('role:student');
    });

    Route::prefix('v1')->group(function () {
        Route::post('/tutor/chat', [SocraticTutorController::class, 'store'])->middleware(['role:student', 'throttle:60,1']);
        Route::get('/tutor/sessions', [SocraticTutorController::class, 'index'])->middleware('role:student');
    });
});

Route::prefix('admin')->name('admin.')->middleware(['auth:sanctum', 'role:admin', 'password.changed'])->group(function () {
    Route::patch('/users/{user}/toggle-active', [Admin\UserController::class, 'toggleActive'])->name('users.toggle-active');
    Route::post('/users/{user}/reset-password', [Admin\UserController::class, 'resetPassword'])->name('users.reset-password');
    Route::apiResource('users', Admin\UserController::class);

    Route::apiResource('classrooms', Admin\ClassroomController::class);
    Route::apiResource('courses', Admin\CourseController::class);

    Route::post('/periods/{period}/set-current', [Admin\AcademicPeriodController::class, 'setCurrent'])->name('periods.set-current');
    Route::apiResource('periods', Admin\AcademicPeriodController::class);

    Route::post('/enrollments/bulk', [Admin\EnrollmentController::class, 'import'])->name('enrollments.bulk');
    Route::apiResource('enrollments', Admin\EnrollmentController::class)->only(['store', 'destroy']);

    Route::post('/guardians/{guardian}/students', [Admin\GuardianController::class, 'linkStudent'])->name('guardians.students.link');
    Route::get('/metrics', [Admin\MetricsController::class, 'index'])->name('metrics');
    Route::get('/audit-logs', [Admin\AuditLogController::class, 'index'])->name('audit-logs.index');
});
