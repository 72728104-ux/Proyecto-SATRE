"""Ramas de error y helpers del cliente Gemini (sin red)."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from google.genai import errors, types

from app import config
from app.core import config as core_config
from app.services.ai import external_client
from app.services.ai.create_protocol import SocraticCreateTurn
from app.services.ai.external_client import (
    ExternalAIService,
    TeacherAssistantReply,
    TeacherPedagogicalPlan,
)


def _settings(**overrides) -> core_config.Settings:
    values = dict(
        x_internal_key="k" * 32,
        gemini_api_key="test-secret-key",
        ai_model_name="gemini-1.5-flash",
        ai_fallback_model_name="gemini-1.5-flash",
        ai_timeout_seconds=10.0,
    )
    values.update(overrides)
    return core_config.Settings.model_construct(**values)


class FakeResponse:
    def __init__(self, text="", parsed=None, prompt_feedback=None, candidates=None):
        self.text = text
        self.parsed = parsed
        self.prompt_feedback = prompt_feedback
        self.candidates = candidates


class FakeAioModels:
    def __init__(self, handler):
        self._handler = handler
        self.calls = []

    async def generate_content(self, *, model, contents, config=None):
        self.calls.append({"model": model, "contents": contents, "config": config})
        return await self._handler(model, contents, config)


class FakeClient:
    def __init__(self, handler):
        self.aio = SimpleNamespace(models=FakeAioModels(handler))


def _service(handler, **overrides) -> ExternalAIService:
    return ExternalAIService(client=FakeClient(handler), settings=_settings(**overrides))


# --- key / settings helpers --------------------------------------------------


def test_load_gemini_key_falls_back_to_file_values(tmp_path, monkeypatch):
    env_file = tmp_path / "custom.env"
    env_file.write_text("GEMINI_API_KEY=file-only-key\n", encoding="utf-8")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setattr(external_client, "ensure_gemini_api_key", lambda path=None: None)
    assert external_client._load_gemini_key_from_dotenv(env_file) == "file-only-key"


def test_load_gemini_key_returns_none_without_file(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(external_client, "ensure_gemini_api_key", lambda path=None: None)
    assert external_client._load_gemini_key_from_dotenv(tmp_path / "missing.env") is None


def test_attach_gemini_key_sets_frozen_settings():
    settings = config.Settings(
        internal_key="k" * 32,
        db_host="127.0.0.1",
        db_port=3306,
        db_database="satre",
        db_username="satre_ro",
        db_password="",
        max_body_bytes=1024,
        gemini_api_key=None,
    )
    external_client._attach_gemini_key(settings, "loaded")
    assert settings.gemini_api_key == "loaded"


def test_attach_gemini_key_respects_existing_value_and_ignores_unsettable():
    settings = _settings(gemini_api_key="already")
    external_client._attach_gemini_key(settings, "new")
    assert settings.gemini_api_key == "already"

    assert external_client._attach_gemini_key(settings, None) is None

    class Slotted:
        __slots__ = ()

    slotted = Slotted()
    external_client._attach_gemini_key(slotted, "k")
    assert not hasattr(slotted, "gemini_api_key")


def test_timeout_seconds_bounds_values():
    assert external_client._timeout_seconds(SimpleNamespace(ai_timeout_seconds=0)) == 30.0
    assert external_client._timeout_seconds(SimpleNamespace(ai_timeout_seconds=-5)) == 30.0
    assert external_client._timeout_seconds(SimpleNamespace(ai_timeout_seconds=45)) == 30.0
    assert external_client._timeout_seconds(SimpleNamespace(ai_timeout_seconds=5)) == 5.0
    assert external_client._timeout_seconds(SimpleNamespace(ai_timeout_seconds=None)) == 30.0


# --- response helpers --------------------------------------------------------


def test_safety_blocked_by_candidate_finish_reason():
    blocked = SimpleNamespace(
        candidates=[SimpleNamespace(finish_reason=types.FinishReason.SAFETY)]
    )
    assert external_client._is_safety_blocked(blocked) is True

    safe = SimpleNamespace(
        candidates=[SimpleNamespace(finish_reason=types.FinishReason.STOP)],
        prompt_feedback=None,
    )
    assert external_client._is_safety_blocked(safe) is False
    assert external_client._is_safety_blocked(SimpleNamespace(candidates=None, prompt_feedback=None)) is False


def test_history_contents_normalizes_strings_dicts_and_skips_noise():
    contents = external_client._history_contents(
        [
            "  hola  ",
            {"text": "sin content", "role": None},
            {"content": "", "role": "model"},
            123,
            object(),
            {"content": "soy docente", "role": "teacher"},
        ]
    )
    assert [content.role for content in contents] == ["user", "user", "user"]
    assert [content.parts[0].text for content in contents] == [
        "hola", "sin content", "soy docente",
    ]


def test_history_contents_handles_none_and_empty():
    assert external_client._history_contents(None) == []
    assert external_client._history_contents([]) == []


# --- parsing helpers ---------------------------------------------------------


def test_parse_teacher_plan_sources():
    service = _service(lambda *_a: FakeResponse())
    assert service._parse_teacher_plan(SimpleNamespace(parsed={"summary": "dict"}), None).summary == "dict"
    assert service._parse_teacher_plan(None, '{"summary": "json"}').summary == "json"
    plan = TeacherPedagogicalPlan(summary="model")
    assert service._parse_teacher_plan(SimpleNamespace(parsed=plan), None) is plan


def test_parse_teacher_assistant_sources():
    service = _service(lambda *_a: FakeResponse())
    reply = service._parse_teacher_assistant(
        SimpleNamespace(parsed={"text": "dict", "summary": "s"}), None
    )
    assert reply.text == "dict"
    assert service._parse_teacher_assistant(None, '{"text": "json", "summary": "s"}').text == "json"
    model = TeacherAssistantReply(text="model", summary="s")
    assert service._parse_teacher_assistant(SimpleNamespace(parsed=model), None) is model


# --- async generation branches ----------------------------------------------


@pytest.mark.asyncio
async def test_socratic_invalid_structured_response():
    async def handler(_model, _contents, _config):
        return FakeResponse(text="no-json", parsed={"create_phase": "bogus"})

    result = await _service(handler).generate_socratic_guidance(
        system_privacy="",
        context={},
        sanitized_message="ayuda",
    )
    assert result["available"] is False
    assert result["reason"] == "invalid_response"
    assert result["guidance"] == "no-json"


@pytest.mark.asyncio
async def test_teacher_plan_invalid_structured_response():
    async def handler(_model, _contents, _config):
        return FakeResponse(text="no-json", parsed={"bad": 1})

    result = await _service(handler).generate_teacher_recommendation(context={})
    assert result["available"] is False
    assert result["reason"] == "invalid_response"
    assert result["actions"] == []


@pytest.mark.asyncio
async def test_teacher_assistant_unavailable_returns_empty_contract():
    async def handler(_model, _contents, _config):
        raise errors.ServerError(
            503,
            {"error": {"code": 503, "status": "UNAVAILABLE", "message": "overloaded"}},
        )

    result = await _service(handler).generate_teacher_assistant(
        system_privacy="",
        context={},
        sanitized_message="consulta",
    )
    assert result["available"] is False
    assert result["reason"] == "api_unavailable"
    assert result["text"] is None
    assert result["actions"] == []
    assert result["criterion_focus"] is None


@pytest.mark.asyncio
async def test_teacher_assistant_invalid_structured_response():
    async def handler(_model, _contents, _config):
        return FakeResponse(text="no-json", parsed={"bad": 1})

    result = await _service(handler).generate_teacher_assistant(
        system_privacy="",
        context={},
        sanitized_message="consulta",
    )
    assert result["available"] is False
    assert result["reason"] == "invalid_response"
    assert result["materials"] == []


@pytest.mark.asyncio
async def test_generate_skips_when_api_key_missing(monkeypatch):
    monkeypatch.setattr(external_client, "_load_gemini_key_from_dotenv", lambda *a, **k: None)
    service = _service(lambda *_a: FakeResponse(), gemini_api_key=None)
    result = await service._generate([], object())
    assert result["available"] is False
    assert result["reason"] == "not_configured"


@pytest.mark.asyncio
async def test_generate_returns_api_error_when_no_models_available():
    service = _service(lambda *_a: FakeResponse())
    service._models_to_try = lambda extra=None: []
    result = await service._generate([], object())
    assert result["available"] is False
    assert result["reason"] == "api_error"


@pytest.mark.asyncio
async def test_generate_once_unexpected_exception_is_wrapped():
    async def handler(_model, _contents, _config):
        raise RuntimeError("boom")

    result = await _service(handler).generate_socratic_guidance(
        system_privacy="",
        context={},
        sanitized_message="ayuda",
    )
    assert result["available"] is False
    assert result["reason"] == "api_error"
    assert "boom" in result["provider_error"]


def test_from_api_error_generic_status_returns_api_error():
    service = _service(lambda *_a: FakeResponse())
    exc = errors.APIError(
        418,
        {"error": {"code": 418, "status": "TEAPOT", "message": "no soy una tetera"}},
    )
    result = service._from_api_error(exc)
    assert result["available"] is False
    assert result["reason"] == "api_error"
    assert result["http_status"] == 418
    assert result["provider_status"] == "TEAPOT"
    assert "tetera" in result["provider_error"]


def test_models_to_try_deduplicates_and_appends_extras():
    service = _service(lambda *_a: FakeResponse(), ai_fallback_model_name="fallback-x")
    assert service._models_to_try() == ["gemini-1.5-flash", "fallback-x"]
    assert service._models_to_try([" fallback-x ", "extra", ""]) == [
        "gemini-1.5-flash", "fallback-x", "extra",
    ]


@pytest.mark.asyncio
async def test_socratic_returns_structured_public_dict():
    turn = SocraticCreateTurn(create_phase="explicar", explanation="Pista breve")
    async def handler(_model, _contents, _config):
        return FakeResponse(text=turn.model_dump_json(), parsed=turn)

    result = await _service(handler).generate_socratic_guidance(
        system_privacy="privacidad",
        context={"create_phase": "explicar"},
        sanitized_message="ayuda",
        history=None,
    )
    assert result["available"] is True
    assert result["create_phase"] == "explicar"
    assert result["explanation"] == "Pista breve"
