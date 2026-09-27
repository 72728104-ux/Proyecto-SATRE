<?php

namespace App\Support;

final class Roles
{
    public const ADMIN = 'admin';

    public const TEACHER = 'teacher';

    public const MONITOR = 'monitor';

    public const STUDENT = 'student';

    public const GUARDIAN = 'guardian';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::ADMIN,
            self::TEACHER,
            self::MONITOR,
            self::STUDENT,
            self::GUARDIAN,
        ];
    }
}
