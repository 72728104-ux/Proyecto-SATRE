<?php

namespace Tests\Unit;

use App\Support\InstitutionalIdentity;
use Tests\TestCase;

class InstitutionalIdentityTest extends TestCase
{
    public function test_builds_institutional_emails_from_dni(): void
    {
        $this->assertTrue(InstitutionalIdentity::isDni('78901234'));
        $this->assertFalse(InstitutionalIdentity::isDni('7890123'));
        $this->assertFalse(InstitutionalIdentity::isDni('d78901234'));
        $this->assertTrue(InstitutionalIdentity::isLoginIdentifier('78901234'));
        $this->assertTrue(InstitutionalIdentity::isLoginIdentifier('78901234@coar.edu.pe'));
        $this->assertFalse(InstitutionalIdentity::isLoginIdentifier('no-es-correo'));

        $this->assertSame('78901234@coar.edu.pe', InstitutionalIdentity::studentEmail('78901234'));
        $this->assertSame('d45678901@coar.edu.pe', InstitutionalIdentity::teacherEmail('45678901'));
        $this->assertSame('d45678901@coar.edu.pe', InstitutionalIdentity::seededTeacherEmail());
        $this->assertSame('78901234@coar.edu.pe', InstitutionalIdentity::seededStudentEmail());
    }
}
