"""Casos límite de la configuración heredada y de app.core.config."""
from __future__ import annotations

import pytest

from app import config
from app.core import config as core_config


def test_ensure_gemini_api_key_returns_none_without_env_or_file(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert config.ensure_gemini_api_key(tmp_path / "missing.env") is None


def test_internal_key_requires_a_long_value(monkeypatch):
    monkeypatch.setenv("X_INTERNAL_KEY", "short")
    monkeypatch.setenv("INTERNAL_KEY", "also-short")
    with pytest.raises(RuntimeError, match="al menos 32"):
        config._internal_key()


def test_core_settings_prefers_long_internal_key_and_handles_non_dict():
    assert core_config.Settings._prefer_valid_internal_key("no-dict") == "no-dict"

    merged = core_config.Settings._prefer_valid_internal_key({
        "X_INTERNAL_KEY": "short",
        "INTERNAL_KEY": "k" * 32,
    })
    assert merged["X_INTERNAL_KEY"] == "k" * 32
    assert merged["x_internal_key"] == "k" * 32

    empty = core_config.Settings._prefer_valid_internal_key({})
    assert "X_INTERNAL_KEY" not in empty


def test_core_settings_field_validators_normalize_values():
    assert core_config.Settings._blank_optional("   ") is None
    assert core_config.Settings._blank_optional(" key ") == " key "
    assert core_config.Settings._blank_optional(None) is None

    assert core_config.Settings._primary_model_name(" gemini-3.5-flash-lite ") == "gemini-1.5-flash"
    assert core_config.Settings._primary_model_name(None) == "gemini-1.5-flash"
    assert core_config.Settings._fallback_model_name("") == "gemini-1.5-flash-8b"
    assert core_config.Settings._fallback_model_name("gemini-4-custom") == "gemini-4-custom"
