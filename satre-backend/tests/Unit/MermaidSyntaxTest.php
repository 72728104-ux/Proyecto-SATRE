<?php

namespace Tests\Unit;

use App\Support\MermaidSyntax;
use Tests\TestCase;

class MermaidSyntaxTest extends TestCase
{
    public function test_quotes_bracket_labels_that_contain_parentheses(): void
    {
        $this->assertSame(
            "flowchart TD\n    A[\"Inicio (x1, y1)\"] --> B[Fin]",
            MermaidSyntax::sanitize("flowchart TD\n    A[Inicio (x1, y1)] --> B[Fin]"),
        );
    }

    public function test_does_not_double_quote_or_touch_plain_labels(): void
    {
        $quoted = "flowchart TD\n    A[\"Inicio (x1, y1)\"] --> B[Fin]";
        $plain = "flowchart TD\n    A[Δy] --> M[pendiente]";

        $this->assertSame($quoted, MermaidSyntax::sanitize($quoted));
        $this->assertSame($plain, MermaidSyntax::sanitize($plain));
        $this->assertNull(MermaidSyntax::sanitize(null));
    }

    public function test_strips_fences_control_chars_and_breaking_markup(): void
    {
        $this->assertSame(
            "flowchart TD\n    A[\"Inicio x1\"] --> B[Fin]",
            MermaidSyntax::sanitize("```mermaid\nflowchart TD\n    A[Inicio \"x1\"] --> B[Fin]\n```"),
        );
        $this->assertSame(
            "flowchart TD\n    A[\"Inicio (x1, y1)\"] --> B[Fin]",
            MermaidSyntax::sanitize("flowchart TD\n    A[Inicio (x1, y1)] --> B[Fin]\x00"),
        );
    }
}
