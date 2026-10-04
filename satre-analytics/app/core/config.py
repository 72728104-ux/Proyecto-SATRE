"""Configuración centralizada de entorno (SATRE TOBE-3 §4).

Lee puerto del servicio, MySQL `satre_ro`, cabecera `X-Internal-Key`
y credenciales de la API de IA externa. Sin secretos en código.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    port: int = Field(default=8001, ge=1, le=65535)

    db_host: str = "127.0.0.1"
    db_port: int = Field(default=3306, ge=1, le=65535)
    db_database: str = "satre"
    db_username: str = "satre_ro"
    db_password: str = ""

    x_internal_key: str = Field(
        min_length=32,
        validation_alias=AliasChoices("X_INTERNAL_KEY", "INTERNAL_KEY"),
        description="Valor del header X-Internal-Key compartido con Laravel.",
    )

    gemini_api_key: str | None = None
    ai_model_name: str = "gemini-3.8-flash"
    ai_timeout_seconds: float = Field(default=20.0, gt=0)

    @model_validator(mode="before")
    @classmethod
    def _prefer_valid_internal_key(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        x_key = str(data.get("X_INTERNAL_KEY") or data.get("x_internal_key") or "").strip()
        legacy = str(data.get("INTERNAL_KEY") or data.get("internal_key") or "").strip()
        chosen = x_key if len(x_key) >= 32 else legacy
        if chosen:
            data["X_INTERNAL_KEY"] = chosen
            data["x_internal_key"] = chosen
        return data

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def _blank_optional(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("ai_model_name", mode="before")
    @classmethod
    def _default_model_name(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return "gemini-3.8-flash"
        return value

    @property
    def internal_key(self) -> str:
        return self.x_internal_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
