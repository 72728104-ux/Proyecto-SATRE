"""Ramas límite del protocolo C.R.E.A.T.E. (intenciones, Markdown, payloads)."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.services.ai import create_protocol as cp


def test_detect_intent_accepts_compact_aliases():
    assert cp.detect_intent("hint") == cp.INTENT_HINT
    assert cp.detect_intent("pista") == cp.INTENT_HINT
    assert cp.detect_intent(None, "hint") == cp.INTENT_HINT
    assert cp.detect_intent("diagram") == cp.INTENT_DIAGRAM
    assert cp.detect_intent("mermaid") == cp.INTENT_DIAGRAM
    assert cp.detect_intent("quiz") == cp.INTENT_QUIZ
    assert cp.detect_intent("   ") is None
    assert cp.detect_intent("necesito una pista larga") is None


def test_phase_helpers_fall_back_to_defaults():
    assert cp.create_phase_for_step("desconocido") == "conectar"
    assert cp.create_phase_for_step(None) == "conectar"
    assert cp.step_for_create_phase(None) == "diagnostico"
    assert cp.step_for_create_phase("desconocido") == "diagnostico"
    assert cp.step_for_create_phase("aplicar") == "verificacion"


def test_public_quiz_accepts_models_and_filters_invalid_options():
    block = cp.QuizBlock(question="¿Cuál?", options=[cp.QuizOption(id="a", text="uno")])
    assert cp._public_quiz(block) == {
        "question": "¿Cuál?",
        "options": [{"id": "a", "text": "uno"}],
    }

    assert cp._public_quiz({"question": "Q", "options": ["texto", {"id": "", "text": "x"}, {"id": "b", "text": ""}]}) is None
    assert cp._public_quiz({"question": "", "options": [{"id": "a", "text": "x"}]}) is None
    assert cp._public_quiz({"question": "Q", "options": "no-es-lista"}) is None
    assert cp._public_quiz(None) is None


def test_public_visual_accepts_models_and_requires_title():
    resource = cp.VisualResource(title="Recta", description="  sube  ")
    assert cp._public_visual(resource) == {"title": "Recta", "description": "sube"}
    assert cp._public_visual({"title": "  ", "description": "x"}) is None
    assert cp._public_visual({"title": "Mapa"}) == {"title": "Mapa", "description": ""}
    assert cp._public_visual("texto") is None


def test_clean_mermaid_strips_fences_and_rejects_long_content():
    cleaned = cp._clean_mermaid(
        "```mermaid\nflowchart TD\n A[Inicio (x)] --> B[Fin]\n```"
    )
    assert cleaned.startswith("flowchart TD")
    assert 'A["Inicio (x)"]' in cleaned

    plain_fence = cp._clean_mermaid("```\nflowchart TD\n A-->B\n```")
    assert plain_fence == "flowchart TD\n A-->B"

    assert cp._clean_mermaid(None) is None
    assert cp._clean_mermaid("   ") is None
    assert cp._clean_mermaid("x" * 4001) is None


def test_parse_markdown_uses_plain_mermaid_fence_as_fallback():
    text = "Explica la idea\n```mermaid\nflowchart TD\n A-->B\n```"
    parsed = cp.parse_create_markdown(text)
    assert parsed["diagram_mermaid"] == "flowchart TD\n A-->B"
    assert "```" not in parsed["explanation"]
    assert parsed["explanation"] == "Explica la idea"


def test_normalize_socratic_payload_invalid_phase_uses_safe_fallback():
    payload = cp.normalize_socratic_payload(
        {"create_phase": "fase-inventada", "explanation": "texto"},
        fallback_phase="otra-invalida",
    )
    assert payload["create_phase"] == "conectar"
    assert payload["available"] is True
    assert payload["explanation"] == "texto"


def test_normalize_socratic_payload_preserves_valid_fallback_phase():
    payload = cp.normalize_socratic_payload(
        {"create_phase": "fase-inventada", "explanation": "texto"},
        fallback_phase="aplicar",
    )
    assert payload["create_phase"] == "aplicar"


def test_reply_from_create_infers_reply_type():
    assert cp.reply_from_create({"done": True})["type"] == "closing"
    assert cp.reply_from_create({"create_phase": "evaluar"})["type"] == "reflection"
    assert cp.reply_from_create({"create_phase": "explicar"})["type"] == "hint"
    assert cp.reply_from_create({"create_phase": "conectar"})["type"] == "question"
    quiz = {"question": "¿Cuál?", "options": [{"id": "a", "text": "uno"}]}
    reply = cp.reply_from_create({"quiz": quiz})
    assert reply["type"] == "question"
    assert reply["options"] == [{"id": "a", "text": "uno"}]
    assert cp.reply_from_create({}, reply_type="hint")["type"] == "hint"


def test_parse_structured_turn_accepts_model_parsed_dict_json_and_markdown():
    turn = cp.SocraticCreateTurn(create_phase="explicar", explanation="ok")
    assert cp.parse_structured_turn(SimpleNamespace(parsed=turn), None) is turn

    from_dict = cp.parse_structured_turn(
        SimpleNamespace(parsed={"create_phase": "recordar", "explanation": "dict"}),
        None,
    )
    assert from_dict.create_phase == "recordar"

    from_json = cp.parse_structured_turn(
        None,
        '{"create_phase": "aplicar", "explanation": "json"}',
    )
    assert from_json.create_phase == "aplicar"

    from_markdown = cp.parse_structured_turn(
        None,
        "[FASE]: Explicar\nDetalle sin bloques",
    )
    assert from_markdown.create_phase == "explicar"
    assert from_markdown.explanation == "Detalle sin bloques"

    default_phase = cp.parse_structured_turn(None, "Solo texto sin fase")
    assert default_phase.create_phase == "explicar"
    assert default_phase.explanation == "Solo texto sin fase"


def test_parse_structured_turn_rejects_invalid_parsed_dict():
    with pytest.raises(ValidationError):
        cp.parse_structured_turn(SimpleNamespace(parsed={"create_phase": "bogus"}), None)
