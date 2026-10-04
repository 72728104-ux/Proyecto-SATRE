from app.services.ai.create_protocol import (
    detect_intent,
    next_create_phase,
    normalize_socratic_payload,
    parse_create_markdown,
    reply_from_create,
    strip_intent_prefix,
)
from app.socratic import load_scaffolds, next_turn


def test_detects_create_intent_prefixes():
    assert detect_intent("[HINT] Dame una pista") == "hint"
    assert detect_intent("[DIAGRAM_MERMAID] dibuja") == "diagram"
    assert detect_intent("[QUIZ] autoevaluación") == "quiz"
    assert strip_intent_prefix("[HINT] Dame una pista") == "Dame una pista"
    assert detect_intent("no sé la pendiente") is None


def test_create_phase_advances_and_honors_intent():
    assert next_create_phase(None) == "conectar"
    assert next_create_phase("conectar") == "recordar"
    assert next_create_phase("transferir") == "evaluar"
    assert next_create_phase("evaluar") == "evaluar"
    assert next_create_phase("conectar", "hint") == "explicar"
    assert next_create_phase("recordar", "quiz") == "aplicar"
    assert next_create_phase("aplicar", "diagram") == "aplicar"


def test_parse_markdown_blocks():
    raw = """
[FASE]: Aplicar
La pendiente compara dos variaciones.

[QUIZ]
¿Cuál es Δy / Δx entre (0,1) y (2,5)?
a) 4
b) 2
c) 0.5
[/QUIZ]

[DIAGRAM_MERMAID]
flowchart TD
    A[Δy] --> M[pendiente]
    B[Δx] --> M
[/DIAGRAM_MERMAID]

[RECURSO_VISUAL]
titulo: Recta en el plano
descripcion: Observa cómo sube al avanzar.
[/RECURSO_VISUAL]
"""
    parsed = parse_create_markdown(raw)
    assert parsed["create_phase"] == "aplicar"
    assert parsed["quiz"]["options"][1]["id"] == "b"
    assert "flowchart TD" in parsed["diagram_mermaid"]
    assert parsed["visual_resource"]["title"] == "Recta en el plano"
    assert "[QUIZ]" not in parsed["explanation"]


def test_normalize_keeps_guidance_and_strips_quiz_keys():
    payload = normalize_socratic_payload({
        "available": True,
        "guidance": "¿Qué variable puedes aislar primero?",
        "quiz": {
            "question": "Elige",
            "options": [{"id": "a", "text": "x", "correct": True}, {"id": "b", "text": "y"}],
        },
    }, fallback_phase="aplicar")
    assert payload["create_phase"] == "aplicar"
    assert payload["explanation"] == "¿Qué variable puedes aislar primero?"
    assert "correct" not in payload["quiz"]["options"][0]
    reply = reply_from_create(payload)
    assert reply["options"][0] == {"id": "a", "text": "x"}
    assert reply["create_phase"] == "aplicar"


def test_deterministic_turn_exposes_create_phase_and_quiz():
    load_scaffolds.cache_clear()
    result = next_turn("Funciones lineales")
    assert result["create_phase"] == "conectar"
    assert result["reply"]["create_phase"] == "conectar"
    assert result["reply"]["quiz"]["options"]
    assert "correct" not in result["reply"]["quiz"]


def test_diagram_intent_attaches_mermaid_without_revealing_answer():
    load_scaffolds.cache_clear()
    started = next_turn("Funciones lineales")
    result = next_turn(
        "Funciones lineales",
        message="[DIAGRAM_MERMAID] Muéstrame un diagrama",
        state=started["state"],
    )
    assert result["reply"]["diagram_mermaid"]
    assert "flowchart" in result["reply"]["diagram_mermaid"]
    assert result["step"] == "diagnostico"
    assert "correct" not in result["reply"]
