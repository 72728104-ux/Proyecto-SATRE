from app.services.privacy.guardrails import PrivacyGuardService


def test_dni_and_email_masking():
    raw_input = "Hola, mi DNI es 74839201 y mi correo es alumno@coar.edu.pe"
    sanitized = PrivacyGuardService.sanitize_student_input(raw_input)
    assert "74839201" not in sanitized
    assert "alumno@coar.edu.pe" not in sanitized
    assert "[DNI_PROTEGIDO]" in sanitized
    assert "[CORREO_PROTEGIDO]" in sanitized


def test_personal_and_corporate_emails_are_masked():
    raw = "Escríbeme a ana.perez@gmail.com o a 2024a001@coarjunin.edu.pe"
    sanitized = PrivacyGuardService.sanitize_student_input(raw)
    assert "ana.perez@gmail.com" not in sanitized
    assert "2024a001@coarjunin.edu.pe" not in sanitized
    assert sanitized.count("[CORREO_PROTEGIDO]") == 2


def test_phone_and_dotted_dni_are_masked():
    raw = "Mi celular es 987654321, +51 912 345 678 y el DNI 74.839.201"
    sanitized = PrivacyGuardService.sanitize_student_input(raw)
    assert "987654321" not in sanitized
    assert "912 345 678" not in sanitized
    assert "74.839.201" not in sanitized
    assert "[TELEFONO_PROTEGIDO]" in sanitized
    assert "[DNI_PROTEGIDO]" in sanitized


def test_full_name_is_replaced_by_anonymous_label():
    raw = "Me llamo José Luis Quispe Huamán y estudio en el COAR"
    sanitized = PrivacyGuardService.sanitize_student_input(raw)
    assert "José Luis Quispe Huamán" not in sanitized
    assert "[ESTUDIANTE_ANONIMO]" in sanitized


def test_minedu_phrases_are_not_treated_as_names():
    raw = "Tengo Logro Destacado y mi compañero está En Proceso"
    sanitized = PrivacyGuardService.sanitize_student_input(raw)
    assert "Logro Destacado" in sanitized
    assert "En Proceso" in sanitized


def test_empty_input_returns_empty_string():
    assert PrivacyGuardService.sanitize_student_input("") == ""
    assert PrivacyGuardService.sanitize_student_input(None) == ""


def test_safe_context_is_anonymous_and_uses_minedu_scale():
    context = PrivacyGuardService.build_safe_context(
        12,
        {
            "risk_level": "MEDIO",
            "risk_score": 48.2,
            "vigesimal_score": 15.0,
            "trend_slope": -0.4,
            "cluster_id": 1,
            "name": "Ana Pérez Rojas",
            "dni": "74839201",
            "email": "ana.perez@coar.edu.pe",
            "note": "Soy Ana Pérez Rojas, DNI 74839201",
        },
    )

    assert context["student_label"] == "[ESTUDIANTE_ANONIMO]"
    assert context["anonymous_id"].startswith("STUDENT_UUID_")
    assert context["anonymous_id"] != "STUDENT_UUID_12"
    assert not context["anonymous_id"].endswith(":12")
    assert context["qualitative_grade"] == "A"
    assert context["risk_level"] == "MEDIO"
    assert context["trend"] == -0.4
    assert context["cluster_id"] == 1
    assert "name" not in context
    assert "dni" not in context
    assert "email" not in context
    assert "student_id" not in context
    assert "74839201" not in context["note"]
    assert "Ana Pérez Rojas" not in context["note"]
    assert "[DNI_PROTEGIDO]" in context["note"]
    assert "[ESTUDIANTE_ANONIMO]" in context["note"]


def test_safe_context_anonymous_id_is_stable_and_not_reversible_to_id():
    first = PrivacyGuardService.build_safe_context(99, {})
    second = PrivacyGuardService.build_safe_context(99, {})
    other = PrivacyGuardService.build_safe_context(100, {})
    assert first["anonymous_id"] == second["anonymous_id"]
    assert first["anonymous_id"] != other["anonymous_id"]
    assert first["anonymous_id"] != "STUDENT_UUID_99"
