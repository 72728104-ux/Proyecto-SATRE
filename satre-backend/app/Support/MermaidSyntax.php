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
            static function (array $matches): string {
                $label = trim($matches[3]);
                $alreadyQuoted = (str_starts_with($label, '"') && str_ends_with($label, '"'))
                    || (str_starts_with($label, "'") && str_ends_with($label, "'"));

                if ($alreadyQuoted) {
                    $quote = $label[0];
                    $inner = self::stripBreakingChars(substr($label, 1, -1));
                    if ($inner === substr($label, 1, -1)) {
                        return $matches[0];
                    }

                    return $matches[1].$matches[2].$quote.$inner.$quote;
                }

                if (! preg_match('/[()[\]{}<>#&;:,\/\\\\"\']/', $label)) {
                    return $matches[0];
                }

                return $matches[1].$matches[2].'["'.self::stripBreakingChars($label).'"]';
            },
            $text,
        );

        return is_string($quoted) ? $quoted : $text;
    }

    private static function stripBreakingChars(string $label): string
    {
        $clean = str_replace(['"', '`', '<', '>', '#', '&'], '', $label);

        return trim($clean);
    }
}
