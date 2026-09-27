"""Tutor socrático sin LLM (§5.5).

Máquina de estados: diagnostico → pregunta_guia → pista (1/2/3) → verificacion → reflexion → finalizado.
Nunca entrega la solución final: las respuestas correctas del catálogo no salen del servicio y,
ante un error, solo se ofrece la siguiente pista.
El estado es opaco para Laravel: lo guarda en tutor_sessions.state y lo reenvía en cada turno.
"""
from __future__ import annotations

import json
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

from app import config

CATALOG_PATH = Path(__file__).parent / "catalog" / "scaffolds.json"

STEPS = ("diagnostico", "pregunta_guia", "pista", "verificacion", "reflexion", "finalizado")

NO_CATALOG_TEXT = (
    "Aún no tengo una guía para ese tema. Anota tu duda y consúltala con tu docente; "
    "así podremos agregar este tema al catálogo."
)
CLOSING_TEXT = "Buen trabajo. Guarda tu reflexión: te ayudará a planificar tu próximo estudio."


def normalize(text: str | None) -> str:
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower().strip()


@lru_cache
def load_scaffolds() -> dict[str, dict[str, Any]]:
    with CATALOG_PATH.open(encoding="utf-8") as fh:
        return {item["id"]: item for item in json.load(fh)["scaffolds"]}


def find_scaffold(topic: str, catalog: dict[str, dict] | None = None) -> dict | None:
    catalog = load_scaffolds() if catalog is None else catalog
    wanted = normalize(topic)
    if not wanted:
        return None
    if wanted in catalog:
        return catalog[wanted]
    for scaffold in catalog.values():
        names = [normalize(scaffold["topic"]), *(normalize(a) for a in scaffold.get("aliases", []))]
        if any(name and (name == wanted or name in wanted) for name in names):
            return scaffold
    return None


def matched_keywords(message: str | None, keywords: list[str]) -> list[str]:
    text = normalize(message)
    return [kw for kw in keywords if normalize(kw) in text] if text else []


def _public_options(block: dict) -> list[dict]:
    return [{"id": opt["id"], "text": opt["text"]} for opt in block.get("options", [])]


def _reply(kind: str, text: str, options: list[dict] | None = None) -> dict:
    reply: dict[str, Any] = {"type": kind, "text": text}
    if options:
        reply["options"] = options
    return reply


def _response(state: dict | None, reply: dict, scaffold: dict | None, extra: dict | None = None) -> dict:
    meta = {"scaffold_id": scaffold["id"], "subject": scaffold["subject"], "criterion": scaffold.get("criterion")} \
        if scaffold else {"scaffold_id": None}
    if extra:
        meta.update(extra)
    return {
        "state": state,
        "step": state["step"] if state else "finalizado",
        "hint_level": state["hint_level"] if state else 0,
        "reply": reply,
        "done": state is None or state["step"] == "finalizado",
        "meta": meta,
    }


def _new_state(scaffold: dict) -> dict:
    return {
        "version": 1,
        "scaffold_id": scaffold["id"],
        "step": "diagnostico",
        "hint_level": 0,
        "diagnostic_ok": None,
        "verification_attempts": 0,
        "turns": 0,
    }


def _valid_state(state: Any, catalog: dict) -> bool:
    return (
        isinstance(state, dict)
        and state.get("scaffold_id") in catalog
        and state.get("step") in STEPS
        and isinstance(state.get("hint_level"), int)
        and 0 <= state["hint_level"] <= config.SOCRATIC_MAX_HINT_LEVEL
    )


def _to_verification(state: dict, scaffold: dict, prefix: str) -> dict:
    state["step"] = "verificacion"
    block = scaffold["verification"]
    return _response(state, _reply("verification", f"{prefix}{block['question']}", _public_options(block)), scaffold)


def _next_hint_or_verification(state: dict, scaffold: dict, prefix: str = "") -> dict:
    if state["hint_level"] >= config.SOCRATIC_MAX_HINT_LEVEL:
        return _to_verification(state, scaffold, "Probemos comprobar tu razonamiento con otro caso. ")
    state["hint_level"] += 1
    state["step"] = "pista"
    hint = scaffold["hints"][state["hint_level"] - 1]
    return _response(state, _reply("hint", f"{prefix}Pista {state['hint_level']}: {hint}"), scaffold)


def next_turn(
    topic: str,
    message: str | None = None,
    option_id: str | None = None,
    state: dict | None = None,
    catalog: dict[str, dict] | None = None,
) -> dict:
    catalog = load_scaffolds() if catalog is None else catalog

    if not _valid_state(state, catalog):
        scaffold = find_scaffold(topic, catalog)
        if scaffold is None:
            return _response(None, _reply("no_catalog", NO_CATALOG_TEXT), None)
        state = _new_state(scaffold)
        block = scaffold["diagnostic"]
        return _response(state, _reply("question", block["question"], _public_options(block)), scaffold)

    state = dict(state)
    state["turns"] = int(state.get("turns") or 0) + 1
    scaffold = catalog[state["scaffold_id"]]
    step = state["step"]

    if step == "diagnostico":
        block = scaffold["diagnostic"]
        if option_id is None:
            return _response(state, _reply("question", f"Elige una opción. {block['question']}", _public_options(block)), scaffold)
        state["diagnostic_ok"] = option_id == block["correct"]
        state["step"] = "pregunta_guia"
        prefix = "Bien, partes de una base sólida. " if state["diagnostic_ok"] else "Revisemos juntos la idea base. "
        return _response(state, _reply("question", prefix + scaffold["guiding_question"]), scaffold)

    if step in ("pregunta_guia", "pista"):
        if not normalize(message):
            return _response(state, _reply("question", "Cuéntame con tus palabras cómo lo estás pensando."), scaffold)
        hits = matched_keywords(message, scaffold.get("expected_keywords", []))
        if hits:
            return _to_verification(state, scaffold, "Vas por buen camino. ")
        return _next_hint_or_verification(state, scaffold)

    if step == "verificacion":
        block = scaffold["verification"]
        if option_id is None:
            return _response(state, _reply("verification", f"Elige una opción. {block['question']}", _public_options(block)), scaffold)
        if option_id == block["correct"]:
            state["step"] = "reflexion"
            return _response(state, _reply("reflection", "¡Correcto! " + scaffold["reflection_prompt"]), scaffold)
        state["verification_attempts"] = int(state.get("verification_attempts") or 0) + 1
        if state["verification_attempts"] >= config.SOCRATIC_MAX_VERIFICATION_ATTEMPTS:
            state["step"] = "reflexion"
            text = ("Todavía no es la opción correcta. Anota en qué paso dudas y revísalo con tu docente. "
                    + scaffold["reflection_prompt"])
            return _response(state, _reply("reflection", text), scaffold)
        if state["hint_level"] < config.SOCRATIC_MAX_HINT_LEVEL:
            state["hint_level"] += 1
            hint = scaffold["hints"][state["hint_level"] - 1]
            text = f"Todavía no. Pista {state['hint_level']}: {hint} Vuelve a intentarlo: {block['question']}"
        else:
            text = f"Todavía no. Relee la pista 3 y vuelve a intentarlo: {block['question']}"
        return _response(state, _reply("verification", text, _public_options(block)), scaffold)

    if step == "reflexion":
        state["step"] = "finalizado"
        return _response(state, _reply("closing", CLOSING_TEXT), scaffold,
                         {"reflection_provided": bool(normalize(message))})

    return _response(state, _reply("closing", CLOSING_TEXT), scaffold)
