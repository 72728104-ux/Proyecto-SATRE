<?php

namespace App\Support;

/**
 * Identidad institucional TOBE-4: DNI de 8 dígitos y correo por rol.
 */
final class InstitutionalIdentity
{
    public const DOMAIN = 'coar.edu.pe';

    public const DNI_LENGTH = 8;

    public const DNI_PATTERN = '/^\d{8}$/';

    public const ADMIN_DNI = '10000001';

    public const ADMIN_EMAIL = 'admin@coar.edu.pe';

    public const TEACHER_DNI = '45678901';

    public const MONITOR_DNI = '20000002';

    public const MONITOR_EMAIL = 'residencia@coar.edu.pe';

    public const STUDENT_DNI = '78901234';

    public const GUARDIAN_DNI = '10101010';

    public const GUARDIAN_EMAIL = 'apoderado@coar.edu.pe';

    public const COHORT_TEACHER_DNI = '55667788';

    public static function domain(): string
    {
        $configured = config('satre.mail_domain');

        return is_string($configured) && $configured !== '' ? $configured : self::DOMAIN;
    }

    public static function isDni(string $value): bool
    {
        return (bool) preg_match(self::DNI_PATTERN, $value);
    }

    public static function isLoginIdentifier(string $value): bool
    {
        return self::isDni($value) || filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function studentEmail(string $dni): string
    {
        return $dni.'@'.self::domain();
    }

    public static function teacherEmail(string $dni): string
    {
        return 'd'.$dni.'@'.self::domain();
    }

    public static function seededTeacherEmail(): string
    {
        return self::teacherEmail(self::TEACHER_DNI);
    }

    public static function seededStudentEmail(): string
    {
        return self::studentEmail(self::STUDENT_DNI);
    }

    public static function cohortTeacherEmail(): string
    {
        return self::teacherEmail(self::COHORT_TEACHER_DNI);
    }
}
