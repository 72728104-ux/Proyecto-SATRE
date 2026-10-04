<?php

namespace App\Support;

/**
 * §12.3: hacia el motor de analítica solo viajan tema, criterio IB y
 * respuestas estructuradas. Nunca nombre, incidencias ni datos de salud.
 */
final class AnalyticsPrivacy
{
    public const TUTOR_KEYS = ['topic', 'course_id', 'criterion', 'message', 'option_id', 'state'];

    public const HYBRID_TUTOR_KEYS = [
        'student_id',
        'user_message',
        'history',
        'topic',
        'create_phase',
        'intent',
        'criterion',
    ];

    private const FORBIDDEN_KEYS = [
        'name',
        'first_name',
        'last_name',
        'student_name',
        'document_number',
        'dni',
        'email',
        'student_code',
        'incidents',
        'incident',
        'health',
        'salud',
        'phone',
        'telefono',
    ];

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function forTutor(array $payload): array
    {
        $allowed = [];

        foreach (self::TUTOR_KEYS as $key) {
            if (array_key_exists($key, $payload)) {
                $allowed[$key] = $payload[$key];
            }
        }

        return self::stripForbidden($allowed);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function forHybridTutor(array $payload): array
    {
        $allowed = [];

        foreach (self::HYBRID_TUTOR_KEYS as $key) {
            if (array_key_exists($key, $payload)) {
                $allowed[$key] = $payload[$key];
            }
        }

        return self::stripForbidden($allowed);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function stripForbidden(array $payload): array
    {
        $clean = [];

        foreach ($payload as $key => $value) {
            if (in_array(strtolower((string) $key), self::FORBIDDEN_KEYS, true)) {
                continue;
            }

            $clean[$key] = is_array($value) ? self::stripForbidden($value) : $value;
        }

        return $clean;
    }
}
