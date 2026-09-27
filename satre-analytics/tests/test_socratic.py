import json

from app.socratic import load_scaffolds, next_turn

TOPIC = "Funciones lineales"


def contains_key(obj, key):
    if isinstance(obj, dict):
        return key in obj or any(contains_key(v, key) for v in obj.values())
    if isinstance(obj, list):
        return any(contains_key(v, key) for v in obj)
    return False


def test_unknown_topic_returns_no_catalog():
    result = next_turn("astrofísica cuántica")
    assert result["reply"]["type"] == "no_catalog"
    assert result["done"] is True


def test_full_flow_with_hints_never_reveals_answer():
    scaffold = load_scaffolds()["mat-funciones-lineales"]
    turns = [next_turn(TOPIC)]
    turns.append(next_turn(TOPIC, option_id="a", state=turns[-1]["state"]))
    assert turns[-1]["step"] == "pregunta_guia"

    for level in (1, 2, 3):
        turns.append(next_turn(TOPIC, message="no sé", state=turns[-1]["state"]))
        assert turns[-1]["step"] == "pista"
        assert turns[-1]["hint_level"] == level

    turns.append(next_turn(TOPIC, message="sigo sin saber", state=turns[-1]["state"]))
    assert turns[-1]["step"] == "verificacion"

    for _ in range(3):
        turns.append(next_turn(TOPIC, option_id="a", state=turns[-1]["state"]))
    assert turns[-1]["step"] == "reflexion"

    turns.append(next_turn(TOPIC, message="me costó la resta", state=turns[-1]["state"]))
    assert turns[-1]["done"] is True

    dumped = json.dumps(turns, ensure_ascii=False)
    correct_text = next(o["text"] for o in scaffold["verification"]["options"]
                        if o["id"] == scaffold["verification"]["correct"])
    assert not contains_key(turns, "correct")
    assert f"es {correct_text}" not in dumped


def test_keyword_answer_goes_to_verification():
    state = next_turn(TOPIC)["state"]
    state = next_turn(TOPIC, option_id="b", state=state)["state"]
    result = next_turn(TOPIC, message="Calculo la diferencia de y y la divido", state=state)
    assert result["step"] == "verificacion"
    assert "options" in result["reply"]


def test_correct_verification_goes_to_reflection():
    state = {"version": 1, "scaffold_id": "mat-funciones-lineales", "step": "verificacion",
             "hint_level": 0, "diagnostic_ok": True, "verification_attempts": 0, "turns": 3}
    assert next_turn(TOPIC, option_id="b", state=state)["step"] == "reflexion"


def test_tampered_state_restarts():
    result = next_turn(TOPIC, state={"scaffold_id": "no-existe", "step": "reflexion", "hint_level": 9})
    assert result["step"] == "diagnostico"
