<?php

namespace Tests\Unit;

use App\Models\GuidedQuestion;
use App\Support\AnalyticsPrivacy;
use Tests\TestCase;

class AnalyticsPrivacyTest extends TestCase
{
    public function test_tutor_payload_keeps_topic_criterion_and_structured_answer_only(): void
    {
        $payload = AnalyticsPrivacy::forTutor([
            'topic' => 'Fotosíntesis',
            'criterion' => 'A',
            'message' => 'opción b',
            'option_id' => 'b',
            'course_id' => 4,
            'state' => ['step' => 'pregunta_guia'],
            'name' => 'Valeria Chávez',
            'first_name' => 'Valeria',
            'student_code' => 'EST-0003',
            'document_number' => '78901234',
            'incidents' => [['category' => 'salud']],
            'health' => 'asma',
            'student_id' => 12,
        ]);

        $this->assertSame([
            'topic' => 'Fotosíntesis',
            'course_id' => 4,
            'criterion' => 'A',
            'message' => 'opción b',
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
            'history' => [['role' => 'student', 'content' => 'opción b']],
            'topic' => 'Fotosíntesis',
            'create_phase' => 'explicar',
            'intent' => 'hint',
            'criterion' => 'A',
            'name' => 'Valeria Chávez',
            'dni' => '78901234',
            'incidents' => [['category' => 'salud']],
        ]);

        $this->assertSame(12, $payload['student_id']);
        $this->assertSame('explicar', $payload['create_phase']);
        $this->assertSame('hint', $payload['intent']);
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
            'options' => [['id' => 'a', 'text' => 'Fotosíntesis'], ['id' => 'b', 'text' => 'Respiración']],
            'correct_answer' => 'a',
        ]);
        $short = new GuidedQuestion([
            'type' => GuidedQuestion::TYPE_SHORT,
            'correct_answer' => 'hipótesis nula',
        ]);

        $this->assertTrue($choice->isCorrectResponse('Fotosíntesis'));
        $this->assertFalse($choice->isCorrectResponse('b'));
        $this->assertTrue($short->isCorrectResponse('La hipótesis nula del artículo'));
        $this->assertFalse($short->isCorrectResponse('otra idea'));
        $this->assertSame('Correcto.', $choice->feedbackFor(true));
    }
}
