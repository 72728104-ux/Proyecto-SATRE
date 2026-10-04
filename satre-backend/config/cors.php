<?php

$frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter([
        $frontendUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]))),

    // Vite puede caer en otro puerto si 5173 está ocupado (p. ej. 3000).
    'allowed_origins_patterns' => env('APP_ENV') === 'production' ? [] : [
        '#\Ahttps?://(localhost|127\.0\.0\.1)(:\d+)?\z#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
