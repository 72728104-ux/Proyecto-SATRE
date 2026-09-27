<?php

use App\Jobs\RunRiskBatchJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new RunRiskBatchJob)->dailyAt('02:00')->timezone('America/Lima')->name('risk-batch')->withoutOverlapping();
