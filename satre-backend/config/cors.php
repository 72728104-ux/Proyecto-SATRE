<?php

$frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');

/*
 * FRONTEND_URL admite varias URLs separadas por comas.
 * Ojo: el enlace de "restablecer contraseña" usa config('app.frontend_url')
 * tal cual, así que en producción conviene dejar ahí UNA sola URL y añadir
 * los orígenes extra en CORS_ALLOWED_ORIGINS.
 */
$frontendOrigins = array_filter(array_map('trim', explode(',', (string) $frontendUrl)));

$extraOrigins = array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))));

/*
 * Los deploy previews de Netlify usan subdominios que no se pueden enumerar
 * de antemano (https://deploy-preview-42--sitio.netlify.app), por eso se
 * cubren con un patrón. CORS_ALLOW_NETLIFY=false lo desactiva.
 */
$allowNetlify = filter_var(env('CORS_ALLOW_NETLIFY', true), FILTER_VALIDATE_BOOL);

$originPatterns = [];

if ($allowNetlify) {
    $originPatterns[] = '#\Ahttps://[a-z0-9-]+(--[a-z0-9-]+)*\.netlify\.app\z#i';
}

// Vite puede caer en otro puerto si 5173 está ocupado (p. ej. 3000).
if (env('APP_ENV') !== 'production') {
    $originPatterns[] = '#\Ahttps?://(localhost|127\.0\.0\.1)(:\d+)?\z#';
}

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter([
        ...$frontendOrigins,
        ...$extraOrigins,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]))),

    'allowed_origins_patterns' => $originPatterns,

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
