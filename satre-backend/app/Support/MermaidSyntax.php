<?php

namespace App\Support;

/**
 * Mermaid 12 rechaza paréntesis sueltos y comillas sin escapar en nodos
 * de corchetes. También fallan fences markdown, controles y HTML suelto.
 */
final class MermaidSyntax
{
    public static function sanitize(?string $source): ?string
    {
        if ($source === null || $source === '') {
            return $source;
        }

        $text = trim($source);
        $text = (string) preg_replace('/^```(?:mermaid)?\s*/i', '', $text);
        $text = (string) preg_replace('/\s*```$/', '', $text);
        $text = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{200B}-\x{200D}\x{FEFF}]/u', '', $text);
        $text = strtr($text, [
            '“' => '"',
            '”' => '"',
            '„' => '"',
            '‘' => "'",
            '’' => "'",
        ]);

        $quoted = preg_replace_callback(
            '/([A-Za-z_][\w-]*)(\s*)\[([^\]]+)\]/',
            static fn (array $matches): string => self::formatLabel($matches),
            $text,
        );

        return is_string($quoted) ? $quoted : $text;
    }

    /**
     * @param  array<int, string>  $matches
     */
    private static function formatLabel(array $matches): string
    {
        $label = trim($matches[3]);
        $alreadyQuoted = (str_starts_with($label, '"') && str_ends_with($label, '"'))
            || (str_starts_with($label, "'") && str_ends_with($label, "'"));
        $rawInner = $alreadyQuoted ? substr($label, 1, -1) : $label;
        $inner = self::stripBreakingChars($rawInner);
        $needsQuotes = preg_match('/[()[\]{}<>#&;:,\/\\\\"\']/', $label) === 1;

        $formatted = $matches[0];

        if ($alreadyQuoted && $inner !== $rawInner) {
            $quote = $label[0];
            $formatted = $matches[1].$matches[2].$quote.$inner.$quote;
        } elseif (! $alreadyQuoted && $needsQuotes) {
            $formatted = $matches[1].$matches[2].'["'.$inner.'"]';
        }

        return $formatted;
    }

    private static function stripBreakingChars(string $label): string
    {
        $clean = str_replace(['"', '`', '<', '>', '#', '&'], '', $label);

        return trim($clean);
    }
}
