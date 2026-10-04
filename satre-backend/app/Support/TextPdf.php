<?php

namespace App\Support;

/**
 * PDF de texto (Helvetica / WinAnsi) para el reporte de grupo, sin dependencias extra.
 */
class TextPdf
{
    private const LINES_PER_PAGE = 48;

    private const PAGE_WIDTH = 612;

    private const PAGE_HEIGHT = 792;

    private const LEFT = 50;

    private const TOP = 742;

    private const LINE_HEIGHT = 14;

    private const FONT_SIZE = 10;

    /**
     * @param  list<string>  $lines
     */
    public static function fromLines(array $lines): string
    {
        $wrapped = [];
        foreach ($lines === [] ? [''] : $lines as $line) {
            foreach (self::wrap($line) as $part) {
                $wrapped[] = $part;
            }
        }

        $pages = array_chunk($wrapped, self::LINES_PER_PAGE);
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>'];
        $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

        $pageIds = [];
        $nextId = 4;

        foreach ($pages as $pageLines) {
            $contentId = $nextId++;
            $pageId = $nextId++;
            $pageIds[] = $pageId;
            $stream = self::contentStream($pageLines);
            $objects[$contentId] = '<< /Length '.strlen($stream)." >>\nstream\n{$stream}endstream";
            $objects[$pageId] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Contents %d 0 R /Resources << /Font << /F1 3 0 R >> >> >>',
                self::PAGE_WIDTH,
                self::PAGE_HEIGHT,
                $contentId,
            );
        }

        $kids = implode(' ', array_map(fn (int $id) => "$id 0 R", $pageIds));
        $objects[2] = sprintf('<< /Type /Pages /Kids [%s] /Count %d >>', $kids, count($pageIds));
        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= "$id 0 obj\n$body\nendobj\n";
        }

        $startxref = strlen($pdf);
        $size = max(array_keys($objects)) + 1;
        $pdf .= "xref\n0 $size\n0000000000 65535 f \n";
        for ($id = 1; $id < $size; $id++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$id] ?? 0);
        }

        return $pdf."trailer << /Size $size /Root 1 0 R >>\nstartxref\n$startxref\n%%EOF\n";
    }

    /**
     * @return list<string>
     */
    private static function wrap(string $line): array
    {
        if (mb_strlen($line) <= 95) {
            return [$line];
        }

        return explode("\n", wordwrap($line, 95, "\n", true)) ?: [''];
    }

    /**
     * @param  list<string>  $lines
     */
    private static function contentStream(array $lines): string
    {
        $commands = ['BT', '/F1 '.self::FONT_SIZE.' Tf', self::LEFT.' '.self::TOP.' Td'];
        foreach ($lines as $index => $line) {
            if ($index > 0) {
                $commands[] = '0 -'.self::LINE_HEIGHT.' Td';
            }
            $commands[] = '('.self::escape($line).') Tj';
        }
        $commands[] = 'ET';

        return implode("\n", $commands)."\n";
    }

    private static function escape(string $text): string
    {
        $encoded = @iconv('UTF-8', 'Windows-1252//TRANSLIT', $text);
        if ($encoded === false) {
            $encoded = mb_convert_encoding($text, 'Windows-1252', 'UTF-8');
        }

        return strtr((string) $encoded, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
    }
}
