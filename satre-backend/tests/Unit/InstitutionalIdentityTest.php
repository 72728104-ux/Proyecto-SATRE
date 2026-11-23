<?php

namespace Tests\Unit;

use App\Support\InstitutionalIdentity;
use Tests\TestCase;

class InstitutionalIdentityTest extends TestCase
{
    private const STUDENT_DNI = '78901234';
    private const STUDENT_EMAIL = '78901234@coar.edu.pe';

    public function test_builds_institutional_emails_from_dni(): void
    {
        $this->assertTrue(InstitutionalIdentity::isDni(self::STUDENT_DNI));
        $this->assertFalse(InstitutionalIdentity::isDni('7890123'));
        $this->assertFalse(InstitutionalIdentity::isDni('d78901234'));
        $this->assertTrue(InstitutionalIdentity::isLoginIdentifier(self::STUDENT_DNI));
        $this->assertTrue(InstitutionalIdentity::isLoginIdentifier(self::STUDENT_EMAIL));
        $this->assertFalse(InstitutionalIdentity::isLoginIdentifier('no-es-correo'));

        $this->assertSame(self::STUDENT_EMAIL, InstitutionalIdentity::studentEmail(self::STUDENT_DNI));
        $this->assertSame('d45678901@coar.edu.pe', InstitutionalIdentity::teacherEmail('45678901'));
        $this->assertSame('d45678901@coar.edu.pe', InstitutionalIdentity::seededTeacherEmail());
        $this->assertSame(self::STUDENT_EMAIL, InstitutionalIdentity::seededStudentEmail());
    }
}
