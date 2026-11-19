<?php

namespace Tests\Unit;

use App\Models\GuidedQuestion;
use App\Support\AnalyticsPrivacy;
use Tests\TestCase;

class AnalyticsPrivacyTest extends TestCase
{
    private const TOPIC_PHOTOSYNTHESIS = 'Fotosíntesis';
    private const OPTION_B_MESSAGE = 'opción b';
    private const STUDENT_NAME = 'Valeria Chávez';
    private const STUDENT_DNI = '78901234';

    public function test_tutor_payload_keeps_topic_criterion_and_structured_answer_only(): void
    {
        $payload = AnalyticsPrivacy::forTutor([
            'topic' => self::TOPIC_PHOTOSYNTHESIS,
            'criterion' => 'A',
            'message' => self::OPTION_B_MESSAGE,
            'option_id' => 'b',
            'course_id' => 4,
            'state' => ['step' => 'pregunta_guia'],
            'name' => self::STUDENT_NAME,
            'first_name' => 'Valeria',
            'student_code' => 'EST-0003',
            'document_number' => self::STUDENT_DNI,
            'incidents' => [['category' => 'salud']],
            'health' => 'asma',
            'student_id' => 12,
        ]);

        $this->assertSame([
            'topic' => self::TOPIC_PHOTOSYNTHESIS,
            'course_id' => 4,
            'criterion' => 'A',
            'message' => self::OPTION_B_MESSAGE,
            'option_id' => 'b',
            'state' => ['step' => 'pregunta_guia'],
        ], $payload);
        $this->assertArrayNotHasKey('name', $payload);
        $this->assertArrayNotHasKey('incidents', $payload);
        $this->assertArrayNotHasKey('health', $payload);
        $this->assertArrayNotHasKey('student_id', $payload);
    }

    public function test_hybrid_tutor_keeps_internal_student_id_and_create_phase(): void
    {
        $payload = AnalyticsPrivacy::forHybridTutor([
            'student_id' => 12,
            'user_message' => '[HINT] Dame una pista',
            'history' => [['role' => 'student', 'content' => self::OPTION_B_MESSAGE]],
            'topic' => self::TOPIC_PHOTOSYNTHESIS,
            'create_phase' => 'explicar',
            'intent' => 'hint',
            'criterion' => 'A',
            'name' => self::STUDENT_NAME,
            'dni' => self::STUDENT_DNI,
            'incidents' => [['category' => 'salud']],
        ]);

        $this->assertSame(12, $payload['student_id']);
        $this->assertSame('explicar', $payload['create_phase']);
        $this->assertSame('hint', $payload['intent']);
        $this->assertArrayNotHasKey('name', $payload);
        $this->assertArrayNotHasKey('dni', $payload);
        $this->assertArrayNotHasKey('incidents', $payload);
    }

    public function test_teacher_assistant_keeps_classroom_and_strips_pii(): void
    {
        $payload = AnalyticsPrivacy::forTeacherAssistant([
            'classroom_id' => 7,
            'student_id' => 12,
            'user_message' => '¿Qué actividades remediales sugieres para la competencia D?',
            'history' => [['role' => 'teacher', 'content' => 'estado del aula']],
            'criterion' => 'D',
            'name' => self::STUDENT_NAME,
            'dni' => self::STUDENT_DNI,
            'incidents' => [['category' => 'salud']],
        ]);

        $this->assertSame(7, $payload['classroom_id']);
        $this->assertSame(12, $payload['student_id']);
        $this->assertSame('D', $payload['criterion']);
        $this->assertArrayNotHasKey('name', $payload);
        $this->assertArrayNotHasKey('dni', $payload);
        $this->assertArrayNotHasKey('incidents', $payload);
    }

    public function test_nested_personal_keys_are_stripped(): void
    {
        $payload = AnalyticsPrivacy::stripForbidden([
            'topic' => 'Célula',
            'meta' => [
                'student_name' => 'Valeria',
                'salud' => 'fiebre',
                'hint_level' => 1,
            ],
        ]);

        $this->assertSame([
            'topic' => 'Célula',
            'meta' => ['hint_level' => 1],
        ], $payload);
    }

    public function test_guided_question_rules_do_not_need_analytics(): void
    {
        $choice = new GuidedQuestion([
            'type' => GuidedQuestion::TYPE_MULTIPLE_CHOICE,
            'options' => [['id' => 'a', 'text' => self::TOPIC_PHOTOSYNTHESIS], ['id' => 'b', 'text' => 'Respiración']],
            'correct_answer' => 'a',
        ]);
        $short = new GuidedQuestion([
            'type' => GuidedQuestion::TYPE_SHORT,
            'correct_answer' => 'hipótesis nula',
        ]);

        $this->assertTrue($choice->isCorrectResponse(self::TOPIC_PHOTOSYNTHESIS));
        $this->assertFalse($choice->isCorrectResponse('b'));
        $this->assertTrue($short->isCorrectResponse('La hipótesis nula del artículo'));
        $this->assertFalse($short->isCorrectResponse('otra idea'));
        $this->assertSame('Correcto.', $choice->feedbackFor(true));
    }
}
