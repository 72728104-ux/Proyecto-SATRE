<?php

namespace Database\Factories;

use App\Models\TutorMessage;
use App\Models\TutorSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TutorMessage>
 */
class TutorMessageFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tutor_session_id' => TutorSession::factory(),
            'role' => TutorMessage::ROLE_TUTOR,
            'content' => '¿Qué datos te da el enunciado?',
            'meta' => ['step' => 'pregunta_guia'],
        ];
    }

    public function student(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => TutorMessage::ROLE_STUDENT,
            'content' => 'Me piden despejar x.',
        ]);
    }
}
