<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GuidedQuestion extends Model
{
    public const TYPE_MULTIPLE_CHOICE = 'multiple_choice';

    public const TYPE_SHORT = 'short';

    public const TYPES = [self::TYPE_MULTIPLE_CHOICE, self::TYPE_SHORT];

    protected $fillable = [
        'reading_material_id',
        'prompt',
        'type',
        'options',
        'correct_answer',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
        ];
    }

    public function isCorrectResponse(string $response): bool
    {
        $given = self::normalize($response);
        $expected = self::normalize($this->correct_answer);

        if ($given === '' || $expected === '') {
            return false;
        }

        if ($given === $expected) {
            return true;
        }

        if ($this->type === self::TYPE_MULTIPLE_CHOICE) {
            foreach ($this->options ?? [] as $option) {
                if (! is_array($option)) {
                    continue;
                }

                $id = self::normalize((string) ($option['id'] ?? ''));
                $text = self::normalize((string) ($option['text'] ?? ''));

                $matchesOption = ($id !== '' && $given === $id) || ($text !== '' && $given === $text);
                $optionIsCorrect = ($id !== '' && $expected === $id) || ($text !== '' && $expected === $text);

                if ($matchesOption && $optionIsCorrect) {
                    return true;
                }
            }

            return false;
        }

        $tokens = preg_split('/\s+/u', $expected, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return $tokens !== [] && collect($tokens)->every(
            fn (string $token) => str_contains($given, $token)
        );
    }

    public function feedbackFor(bool $isCorrect): string
    {
        return $isCorrect
            ? 'Correcto.'
            : 'Incorrecto. La respuesta esperada es: '.$this->correct_answer.'.';
    }

    public static function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $from = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'];
        $to = ['a', 'e', 'i', 'o', 'u', 'u', 'n'];

        return str_replace($from, $to, $value);
    }

    public function readingMaterial(): BelongsTo
    {
        return $this->belongsTo(ReadingMaterial::class);
    }

    public function responses(): HasMany
    {
        return $this->hasMany(GuidedResponse::class);
    }
}
