"""Ramas de la máquina de estados socrática determinista."""
from __future__ import annotations

import pytest

from app import socratic
from app.socratic import load_scaffolds, next_turn

TOPIC = "Funciones lineales"
SCAFFOLD_ID = "mat-funciones-lineales"


def _state(step: str, **overrides) -> dict:
    state = {
        "version": 1,
        "scaffold_id": SCAFFOLD_ID,
        "step": step,
        "hint_level": 0,
        "diagnostic_ok": None,
        "verification_attempts": 0,
        "turns": 0,
    }
    state.update(overrides)
    return state


def test_normalize_and_find_scaffold_edge_cases():
    assert socratic.normalize(None) == ""
    assert socratic.normalize("  ÁÉÍ  ") == "aei"
    assert socratic.find_scaffold("") is None
    assert socratic.find_scaffold("   ") is None
    exact = socratic.find_scaffold(SCAFFOLD_ID)
    assert exact is not None
    assert exact["id"] == SCAFFOLD_ID
    assert socratic.find_scaffold("tema inexistente xyz") is None


def test_attach_create_includes_visual_resource_and_quiz():
    scaffold = load_scaffolds()[SCAFFOLD_ID]
    state = _state("pista", hint_level=1)
    reply = socratic._reply("hint", "texto", [{"id": "a", "text": "uno"}])
    enriched = socratic._attach_create(
        reply,
        state,
        scaffold,
        {"visual_resource": {"title": "Mapa", "description": "breve"}},
    )
    assert enriched["visual_resource"] == {"title": "Mapa", "description": "breve"}
    assert enriched["quiz"]["options"] == [{"id": "a", "text": "uno"}]
    assert state["create_phase"] == "explicar"


def test_diagram_intent_on_verification_and_hint_steps():
    verification = next_turn(
        TOPIC,
        message="[DIAGRAM] muestra el diagrama",
        state=_state("verificacion", diagnostic_ok=True),
    )
    assert verification["step"] == "verificacion"
    assert verification["reply"]["diagram_mermaid"]

    hint = next_turn(
        TOPIC,
        message="[DIAGRAM] muestra el diagrama",
        state=_state("pista", hint_level=1),
    )
    assert hint["reply"]["type"] == "hint"
    assert "¿Qué cambia y qué se mantiene?" in hint["reply"]["text"]


def test_quiz_intent_moves_to_verification():
    result = next_turn(
        TOPIC,
        message="[QUIZ] evalúa lo aprendido",
        state=_state("pregunta_guia"),
    )
    assert result["step"] == "verificacion"
    assert result["reply"]["type"] == "verification"
    assert result["reply"]["options"]


def test_hint_intent_in_guiding_step_returns_next_hint():
    result = next_turn(
        TOPIC,
        option_id="[HINT]",
        state=_state("pregunta_guia"),
    )
    assert result["step"] == "pista"
    assert result["hint_level"] == 1
    assert "Pista 1:" in result["reply"]["text"]


def test_diagnostic_without_option_reminds_to_choose():
    result = next_turn(TOPIC, state=_state("diagnostico"))
    assert result["step"] == "diagnostico"
    assert "Elige una opción" in result["reply"]["text"]
    assert result["reply"]["options"]


def test_guiding_step_without_message_asks_for_reasoning():
    result = next_turn(TOPIC, message=None, state=_state("pregunta_guia"))
    assert result["reply"]["type"] == "question"
    assert "Cuéntame con tus palabras" in result["reply"]["text"]


def test_verification_without_option_reminds_to_choose():
    result = next_turn(TOPIC, state=_state("verificacion"))
    assert result["reply"]["type"] == "verification"
    assert "Elige una opción" in result["reply"]["text"]


def test_wrong_verification_offers_next_hint():
    scaffold = load_scaffolds()[SCAFFOLD_ID]
    block = scaffold["verification"]
    wrong = next(option["id"] for option in block["options"] if option["id"] != block["correct"])

    result = next_turn(
        TOPIC,
        option_id=wrong,
        state=_state("verificacion", hint_level=0),
    )
    assert result["step"] == "verificacion"
    assert result["hint_level"] == 1
    assert "Todavía no. Pista 1:" in result["reply"]["text"]
    assert block["question"] in result["reply"]["text"]


def test_wrong_verification_without_hints_left_asks_to_reread():
    scaffold = load_scaffolds()[SCAFFOLD_ID]
    block = scaffold["verification"]
    wrong = next(option["id"] for option in block["options"] if option["id"] != block["correct"])

    result = next_turn(
        TOPIC,
        option_id=wrong,
        state=_state("verificacion", hint_level=3),
    )
    assert "Relee la pista 3" in result["reply"]["text"]
    assert result["step"] == "verificacion"


def test_finalized_step_returns_closing_reply():
    result = next_turn(TOPIC, state=_state("finalizado"))
    assert result["reply"]["type"] == "closing"
    assert result["done"] is True
    assert result["create_phase"] == "evaluar"


def test_reflection_step_marks_done_and_keeps_reflection_flag():
    result = next_turn(TOPIC, message="me costó la resta", state=_state("reflexion"))
    assert result["step"] == "finalizado"
    assert result["done"] is True
    assert result["reply"]["create_phase"] == "evaluar"


def test_unknown_topic_with_invalid_state_returns_no_catalog():
    result = next_turn("astrofísica cuántica", state={"scaffold_id": "no-existe"})
    assert result["reply"]["type"] == "no_catalog"
    assert result["create_phase"] == "evaluar"
