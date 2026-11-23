"""Prueba aislada: .env → GEMINI_API_KEY → google-genai → Gemini API.

No imprime secretos. Distingue fallos de key, modelo, SDK, red, permisos, cuota o config.
Uso (desde satre-analytics):

    .\\venv\\Scripts\\python.exe scripts\\probe_gemini.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import dotenv_values, load_dotenv

_ENV_FILE = ROOT / ".env"
load_dotenv(_ENV_FILE, override=False)
if not (os.environ.get("GEMINI_API_KEY") or "").strip() and _ENV_FILE.is_file():
    _file_key = (dotenv_values(_ENV_FILE).get("GEMINI_API_KEY") or "").strip()
    if _file_key:
        os.environ["GEMINI_API_KEY"] = _file_key

try:
    from google import genai
    from google.genai import errors, types
except Exception as exc:  # noqa: BLE001
    print("CATEGORY=sdk")
    print(f"ERROR={type(exc).__name__}: {exc}")
    print("DETAIL=No se pudo importar google.genai. Instala google-genai.")
    raise SystemExit(2) from exc


def _redact(text: str, secret: str) -> str:
    if not secret:
        return text
    return text.replace(secret, "[REDACTED]")


def _classify(exc: BaseException) -> str:
    code = getattr(exc, "code", None)
    status = str(getattr(exc, "status", "") or "").upper()
    message = str(exc).lower()
    if isinstance(exc, TimeoutError) or "timeout" in message or "deadline" in message:
        return "timeout"
    if isinstance(exc, (ConnectionError, OSError)) or "getaddrinfo" in message or "connect" in message:
        return "network"
    if code in {401, 403} or status in {"UNAUTHENTICATED", "PERMISSION_DENIED"}:
        if "permission" in message or "not allowed" in message or code == 403:
            return "permissions"
        return "api_key"
    if "api key" in message or "api_key" in message or "invalid key" in message:
        return "api_key"
    if code == 404 or status == "NOT_FOUND" or "not found" in message or "is not found" in message:
        return "model"
    if code == 429 or status == "RESOURCE_EXHAUSTED" or "quota" in message:
        return "quota"
    if code in {500, 502, 503} or status in {"UNAVAILABLE", "INTERNAL"}:
        return "capacity"
    if "model" in message and ("not supported" in message or "unknown" in message):
        return "model"
    return "configuration"


def main() -> int:
    key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    model = (os.environ.get("AI_MODEL_NAME") or "gemini-1.5-flash").strip()
    print(f"GEMINI_API_KEY_PRESENT={bool(key)}")
    print(f"GEMINI_API_KEY_LENGTH={len(key)}")
    print(f"AI_MODEL_NAME={model}")
    if not key:
        print("CATEGORY=configuration")
        print("ERROR=GEMINI_API_KEY no está definida o está vacía en satre-analytics/.env")
        return 1

    try:
        client = genai.Client(
            api_key=key,
            http_options=types.HttpOptions(timeout=30000),
        )
        print("SDK_INIT=ok")
    except Exception as exc:  # noqa: BLE001
        print("CATEGORY=sdk")
        print(f"ERROR={_redact(f'{type(exc).__name__}: {exc}', key)}")
        return 2

    try:
        response = client.models.generate_content(
            model=model,
            contents="Responde exactamente con la palabra pong.",
            config=types.GenerateContentConfig(
                temperature=0,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
        text = (getattr(response, "text", None) or "").strip()
        print("CATEGORY=ok")
        print(f"RESPONSE={text[:400]}")
        return 0
    except errors.APIError as exc:
        category = _classify(exc)
        print(f"CATEGORY={category}")
        print(
            "ERROR="
            + _redact(
                f"{type(exc).__name__} code={getattr(exc, 'code', None)} "
                f"status={getattr(exc, 'status', None)} message={exc}",
                key,
            )
        )
        return 3
    except Exception as exc:  # noqa: BLE001
        category = _classify(exc)
        print(f"CATEGORY={category}")
        print(f"ERROR={_redact(f'{type(exc).__name__}: {exc}', key)}")
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
