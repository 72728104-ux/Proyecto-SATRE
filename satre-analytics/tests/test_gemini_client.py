"""Cliente asíncrono Gemini: modelo, JSON estructurado, socrático y fallos."""
import asyncio
import os

import pytest
from google.genai import errors, types

from app import config
from app.core import config as core_config
from app.services.ai.create_protocol import SocraticCreateTurn
from app.services.ai.external_client import (
    DEFAULT_MODEL_NAME,
    TEACHER_ASSISTANT_FALLBACK_MODEL,
    ExternalAIService,
    TeacherAssistantReply,
    TeacherPedagogicalPlan,
    _load_gemini_key_from_dotenv,
    generate_content,
    get_client,
)
from app.services.privacy.guardrails import PrivacyGuardService


def _clear_caches() -> None:
    get_client.cache_clear()
    config.get_settings.cache_clear()
    core_config.get_settings.cache_clear()


class FakeResponse:
    def __init__(self, text="", parsed=None, prompt_feedback=None, candidates=None):
        self.text = text
        self.parsed = parsed
        self.prompt_feedback = prompt_feedback
        self.candidates = candidates


class FakeAioModels:
    def __init__(self, handler):
        self._handler = handler
        self.last_call = None

    async def generate_content(self, *, model, contents, config=None):
        self.last_call = {"model": model, "contents": contents, "config": config}
        return await self._handler(model, contents, config)


class FakeAio:
    def __init__(self, handler):
        self.models = FakeAioModels(handler)


class FakeClient:
    def __init__(self, handler, sync_handler=None):
        self.aio = FakeAio(handler)
        self.models = type(
            "SyncModels",
            (),
            {"generate_content": sync_handler or (lambda **_kwargs: FakeResponse(text=""))},
        )()


@pytest.fixture
def gemini_env(monkeypatch):
    monkeypatch.setenv("X_INTERNAL_KEY", "k" * 32)
    monkeypatch.setenv("INTERNAL_KEY", "k" * 32)
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key-not-real")
    monkeypatch.setenv("AI_MODEL_NAME", DEFAULT_MODEL_NAME)
    monkeypatch.setenv("AI_FALLBACK_MODEL_NAME", DEFAULT_MODEL_NAME)
    monkeypatch.setenv("AI_TIMEOUT_SECONDS", "10")
    _clear_caches()
    yield
    _clear_caches()


def test_ensure_gemini_api_key_reads_dotenv_when_process_key_is_blank(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("GEMINI_API_KEY=dotenv-loaded-key-not-real\n", encoding="utf-8")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    assert config.ensure_gemini_api_key(env_file) == "dotenv-loaded-key-not-real"
    assert os.environ["GEMINI_API_KEY"] == "dotenv-loaded-key-not-real"
    monkeypatch.setenv("GEMINI_API_KEY", "")
    assert _load_gemini_key_from_dotenv(env_file) == "dotenv-loaded-key-not-real"


def test_unstable_model_alias_uses_stable_flash():
    assert config.resolve_ai_model_name("gemini-3.5-flash-lite") == "gemini-1.5-flash"
    assert config.resolve_ai_model_name("gemini-3.8-flash") == "gemini-1.5-flash"
    assert config.resolve_ai_model_name("gemini-1.5-flash") == "gemini-1.5-flash"
    assert (
        config.resolve_ai_model_name(
            "gemini-3.5-flash-lite",
            fallback=config.STABLE_AI_FALLBACK_MODEL_NAME,
        )
        == "gemini-1.5-flash-8b"
    )


def test_core_settings_default_model_and_timeout():
    assert core_config.Settings.model_fields["ai_model_name"].default == "gemini-1.5-flash"
    assert core_config.Settings.model_fields["ai_fallback_model_name"].default == "gemini-1.5-flash-8b"
    assert core_config.Settings.model_fields["ai_timeout_seconds"].default == 30.0
    assert DEFAULT_MODEL_NAME == "gemini-1.5-flash"


def test_generate_content_uses_ai_model_name(monkeypatch, gemini_env):
    class SyncModels:
        def generate_content(self, model, contents, config=None):
            assert model == DEFAULT_MODEL_NAME
            assert contents == "explica la pendiente"
            return FakeResponse(text="  pista socratica  ")

    class SyncClient:
        def __init__(self, **_kwargs):
            self.models = SyncModels()

    monkeypatch.setattr(
        "app.services.ai.external_client.genai.Client",
        SyncClient,
    )
    try:
        assert generate_content("explica la pendiente") == "pista socratica"
    finally:
        get_client.cache_clear()


def test_get_settings_reads_gemini_env(monkeypatch):
    monkeypatch.setenv("X_INTERNAL_KEY", "k" * 32)
    monkeypatch.setenv("INTERNAL_KEY", "k" * 32)
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key-not-real")
    monkeypatch.setenv("AI_MODEL_NAME", DEFAULT_MODEL_NAME)
    monkeypatch.setenv("AI_FALLBACK_MODEL_NAME", DEFAULT_MODEL_NAME)
    _clear_caches()
    try:
        legacy = config.get_settings()
        core = core_config.get_settings()
        assert legacy.gemini_api_key == "test-gemini-key-not-real"
        assert legacy.ai_model_name == DEFAULT_MODEL_NAME
        assert legacy.ai_fallback_model_name == DEFAULT_MODEL_NAME
        assert core.gemini_api_key == "test-gemini-key-not-real"
        assert core.ai_model_name == DEFAULT_MODEL_NAME
        assert core.ai_fallback_model_name == DEFAULT_MODEL_NAME
        assert core.internal_key == "k" * 32
    finally:
        _clear_caches()


def test_short_x_internal_key_falls_back_to_internal_key(monkeypatch):
    monkeypatch.setenv("X_INTERNAL_KEY", "satre_secret_internal_key_2026")
    monkeypatch.setenv("INTERNAL_KEY", "legacy-internal-key-0123456789abcdef")
    config.get_settings.cache_clear()
    try:
        assert len(os.environ["X_INTERNAL_KEY"]) == 30
        assert config.get_settings().internal_key == "legacy-internal-key-0123456789abcdef"
    finally:
        config.get_settings.cache_clear()


@pytest.mark.asyncio
async def test_socratic_uses_pedagogical_system_instruction(gemini_env):
    turn = SocraticCreateTurn(
        create_phase="explicar",
        explanation="¿Qué dato te falta para plantear la ecuación?",
        reflection="Comprueba si identificaste la variable independiente.",
    )

    async def handler(_model, _contents, config):
        instruction = config.system_instruction
        assert "No entregues la respuesta final" in instruction
        assert "C.R.E.A.T.E." in instruction
        assert 'A["Inicio (x1, y1)"]' in instruction
        assert "comillas dobles" in instruction
        assert PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION[:40] in instruction
        assert config.response_mime_type == "application/json"
        assert config.response_schema is SocraticCreateTurn
        return FakeResponse(text=turn.model_dump_json(), parsed=turn)

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_socratic_guidance(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"anonymous_id": "STUDENT_UUID_test", "qualitative_grade": "B"},
        sanitized_message="No entiendo la pendiente",
        history=[{"role": "student", "content": "hola"}],
    )
    assert result["available"] is True
    assert result["create_phase"] == "explicar"
    assert "ecuación" in result["explanation"]
    assert result["reflection"]
    assert "pendiente" in result["guidance"] or "ecuación" in result["guidance"]
    last = service._client.aio.models.last_call
    assert last["model"] == DEFAULT_MODEL_NAME
    assert last["config"].response_mime_type == "application/json"
    prompt = last["contents"][-1].parts[0].text
    assert "No entiendo la pendiente" in prompt
    assert "Responde a ESE mensaje" in prompt
    assert "concepto incorrecto" in last["config"].system_instruction or "el eje" in last["config"].system_instruction


@pytest.mark.asyncio
async def test_teacher_plan_forces_json_schema(gemini_env):
    plan = TeacherPedagogicalPlan(
        summary="Reforzar resolución de problemas en B",
        actions=["Guiar con preguntas de comprensión"],
        materials=["Ficha MINEDU de retroalimentación"],
    )

    async def handler(_model, _contents, config):
        assert config.response_mime_type == "application/json"
        assert config.response_schema is TeacherPedagogicalPlan
        return FakeResponse(text=plan.model_dump_json(), parsed=plan)

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_teacher_recommendation(
        context={"anonymous_id": "STUDENT_UUID_test", "qualitative_grade": "B"},
    )
    assert result["available"] is True
    assert result["summary"] == plan.summary
    assert result["actions"] == plan.actions
    assert result["materials"] == plan.materials


@pytest.mark.asyncio
async def test_teacher_assistant_forces_json_schema_and_minedu_prompt(gemini_env):
    reply = TeacherAssistantReply(
        text="Para el criterio D, usa un taller de producción.",
        summary="Remedial en criterio D",
        actions=["Rúbrica analítica D"],
        materials=["Ficha MINEDU"],
        criterion_focus="D",
    )

    async def handler(_model, contents, config):
        assert config.response_mime_type == "application/json"
        assert config.response_schema is TeacherAssistantReply
        assert "escala Minedu" in config.system_instruction or "Minedu" in config.system_instruction
        prompt = contents[-1].parts[0].text
        assert "0–20" in prompt or "0-20" in prompt or "MINEDU" in prompt
        return FakeResponse(text=reply.model_dump_json(), parsed=reply)

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_teacher_assistant(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"scale": "minedu_0_20", "passing_score": 11, "criterion_focus": "D"},
        sanitized_message="¿Qué actividades remediales sugieres para la competencia D?",
    )
    assert result["available"] is True
    assert result["text"] == reply.text
    assert result["actions"] == reply.actions
    assert result["criterion_focus"] == "D"
    assert TEACHER_ASSISTANT_FALLBACK_MODEL == "gemini-1.5-flash-8b"


@pytest.mark.asyncio
async def test_auth_error_returns_available_false(gemini_env):
    async def handler(_model, _contents, _config):
        raise errors.ClientError(
            401,
            {"error": {"code": 401, "status": "UNAUTHENTICATED", "message": "API key invalid"}},
        )

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_socratic_guidance(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"anonymous_id": "STUDENT_UUID_test"},
        sanitized_message="ayuda",
    )
    assert result["available"] is False
    assert result["reason"] == "auth_error"
    assert result["http_status"] == 401
    assert result["provider_status"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_quota_exhausted_returns_available_false(gemini_env):
    async def handler(_model, _contents, _config):
        raise errors.ClientError(
            429,
            {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "quota"}},
        )

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_socratic_guidance(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"anonymous_id": "STUDENT_UUID_test"},
        sanitized_message="ayuda",
    )
    assert result["available"] is False
    assert result["reason"] == "quota_exhausted"


@pytest.mark.asyncio
async def test_timeout_and_apierror_return_available_false(gemini_env):
    async def timeout_handler(_model, _contents, _config):
        await asyncio.sleep(0.05)
        return FakeResponse(text="tarde")

    settings = core_config.get_settings()
    slow = ExternalAIService(client=FakeClient(timeout_handler), settings=settings)
    slow._timeout = 0.01
    timed_out = await slow.generate_teacher_recommendation(context={"qualitative_grade": "C"})
    assert timed_out["available"] is False
    assert timed_out["reason"] == "timeout"
    assert timed_out["actions"] == []

    async def api_handler(_model, _contents, _config):
        raise errors.APIError(
            504,
            {"error": {"code": 504, "status": "DEADLINE_EXCEEDED", "message": "timeout"}},
        )

    api_service = ExternalAIService(
        client=FakeClient(api_handler),
        settings=core_config.get_settings(),
    )
    api_result = await api_service.generate_teacher_recommendation(
        context={"qualitative_grade": "C"},
    )
    assert api_result["available"] is False
    assert api_result["reason"] == "timeout"


@pytest.mark.asyncio
async def test_service_unavailable_returns_available_false(gemini_env):
    async def handler(_model, _contents, _config):
        raise errors.ServerError(
            503,
            {"error": {"code": 503, "status": "UNAVAILABLE", "message": "overloaded"}},
        )

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_socratic_guidance(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"anonymous_id": "STUDENT_UUID_test"},
        sanitized_message="el eje",
    )
    assert result["available"] is False
    assert result["reason"] == "api_unavailable"
    assert result["http_status"] == 503
    assert result["provider_status"] == "UNAVAILABLE"


@pytest.mark.asyncio
async def test_safety_blocked_response(gemini_env):
    async def handler(_model, _contents, _config):
        feedback = types.GenerateContentResponsePromptFeedback(
            block_reason=types.BlockedReason.SAFETY,
        )
        return FakeResponse(text="", prompt_feedback=feedback)

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_socratic_guidance(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"anonymous_id": "STUDENT_UUID_test"},
        sanitized_message="contenido bloqueado",
    )
    assert result["available"] is False
    assert result["reason"] == "safety_blocked"


@pytest.mark.asyncio
async def test_capacity_error_falls_back_to_secondary_model(gemini_env, monkeypatch):
    monkeypatch.setenv("AI_MODEL_NAME", "gemini-1.5-flash")
    monkeypatch.setenv("AI_FALLBACK_MODEL_NAME", "gemini-1.5-flash-8b")
    _clear_caches()
    turn = SocraticCreateTurn(
        create_phase="conectar",
        explanation="¿Qué ya sabes de la pendiente?",
        reflection="Comprueba tu definición.",
    )
    models_tried = []

    async def handler(model, _contents, _config):
        models_tried.append(model)
        if model == "gemini-1.5-flash":
            raise errors.ServerError(
                503,
                {"error": {"code": 503, "status": "UNAVAILABLE", "message": "high demand"}},
            )
        return FakeResponse(text=turn.model_dump_json(), parsed=turn)

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    result = await service.generate_socratic_guidance(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"anonymous_id": "STUDENT_UUID_test"},
        sanitized_message="ayuda",
    )
    assert models_tried == ["gemini-1.5-flash", "gemini-1.5-flash-8b"]
    assert result["available"] is True
    assert "pendiente" in result["explanation"]


@pytest.mark.asyncio
async def test_unknown_model_falls_back_and_logs_provider_error(gemini_env, monkeypatch, capsys, caplog):
    monkeypatch.setenv("AI_MODEL_NAME", "gemini-3.5-flash-lite")
    monkeypatch.setenv("AI_FALLBACK_MODEL_NAME", "gemini-1.5-flash-8b")
    _clear_caches()
    turn = SocraticCreateTurn(
        create_phase="conectar",
        explanation="¿Qué ya sabes de la pendiente?",
        reflection="Comprueba tu definición.",
    )
    models_tried = []

    async def handler(model, _contents, _config):
        models_tried.append(model)
        if model == "gemini-1.5-flash":
            raise errors.ClientError(
                404,
                {"error": {"code": 404, "status": "NOT_FOUND", "message": "model not found"}},
            )
        return FakeResponse(text=turn.model_dump_json(), parsed=turn)

    service = ExternalAIService(
        client=FakeClient(handler),
        settings=core_config.get_settings(),
    )
    assert service._model == "gemini-1.5-flash"
    result = await service.generate_socratic_guidance(
        system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
        context={"anonymous_id": "STUDENT_UUID_test"},
        sanitized_message="ayuda",
    )
    captured = capsys.readouterr()
    assert models_tried == ["gemini-1.5-flash", "gemini-1.5-flash-8b"]
    assert result["available"] is True
    assert "[satre-analytics] Gemini APIError" in captured.out
    assert "model not found" in captured.out.lower() or "NOT_FOUND" in captured.out
    assert "gemini APIError" in caplog.text.lower() or "NOT_FOUND" in caplog.text
