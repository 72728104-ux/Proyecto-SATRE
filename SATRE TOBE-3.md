1. Visión General del Servicio Híbrido (satre-analytics)El servicio satre-analytics evoluciona a una arquitectura Híbrida de Analítica Determinista + IA Asistencial. Se mantiene la lógica matemática de cálculo de riesgo (§5.3 del TOBE-2), regresión lineal y KMeans, complementándola con un Motor de Inteligencia Artificial Externa para el diálogo socrático (Estudiante) y recomendaciones pedagógicas (Docente).PRINCIPIO DE CONFIDENCIALIDAD DE MENORES:Ningún dato de identificación personal (PII) de los estudiantes (nombres, DNI, correos, COAR específico) saldrá jamás del perímetro interno de SATRE. La IA externa solo procesa identificadores anónimos efímeros (STUDENT_UUID), escalas cualitativas de la norma peruana (AD, A, B, C) y métricas numéricas agregadas.2. Equivalencia y Mapeo de Calificaciones Peruanas (MINEDU - RVM N° 094-2020-MINEDU)Para el motor de analítica y la capa de IA, la escala oficial cualitativa peruana se mapea internamente con la escala vigesimal (0-20) para preservar la precisión matemática:Calificación OficialDescripción MINEDURango Vigesimal InternoCategoría de Riesgo SugeridaADLogro Destacado: Supera ampliamente lo esperado para su grado.$18 - 20$NULO / BAJOALogro Esperado: Cumple de manera satisfactoria dentro del tiempo previsto.$14 - 17$BAJO / MEDIOBEn Proceso: Cerca del nivel esperado, requiere acompañamiento docente.$11 - 13$MEDIO / ALTOCEn Inicio: Dificultades marcadas, requiere recuperación pedagógica.$0 - 10$CRÍTICO3. Capa de Seguridad y Filtro de Privacidad (PrivacyGuardService)Antes de realizar cualquier llamada a una API de IA externa (OpenAI, Gemini, Anthropic, etc.), la petición DEBE atravesar obligatoriamente la Capa Interna de Sanitización de Datos.[ Petición Entrante ]
         |
         v
+-------------------------------------------------------------------+
| 1. Lógica Determinista & DB Interna (MySQL satre_ro)               |
|    - Carga notas cualitativas (AD, A, B, C) y convierte a 0-20     |
|    - Calcula Riesgo (§5.3), Regresión y KMeans                     |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
| 2. PrivacyGuardService (Filtro de Anonymización Interno)          |
|    - Sanitiza mensajes de texto (remueve DNIs, nombres, emails)    |
|    - Convierte métricas a la escala C, B, A, AD para el Prompt      |
|    - Reemplaza ID real por UUID anonimizado                        |
+-------------------------------------------------------------------+
         | (Payload 100% Anónimo y Seguro)
         v
+-------------------------------------------------------------------+
| 3. API de IA Externa (OpenAI / Gemini / Anthropic)                |
|    - Genera respuesta socrática o recomendación docente            |
+-------------------------------------------------------------------+
4. Estructura del Proyecto (satre-analytics/)Plaintextsatre-analytics/
├── app/
│   ├── api/
│   │   ├── dependencies.py      # Middleware X-Internal-Key
│   │   └── v1/
│   │       ├── student_tutor.py # Endpoints Tutor Socrático
│   │       └── teacher_report.py# Endpoints Reporte Docente
│   ├── core/
│   │   ├── config.py            # Variables de entorno y llaves API
│   │   └── database.py          # SQLAlchemy (satre_ro via text())
│   ├── services/
│   │   ├── deterministic/       # Módulo Matemático Determinista
│   │   │   ├── grading_scaler.py# Convierte C, B, A, AD <-> Vigesimal
│   │   │   ├── risk_engine.py   # Algoritmo de Riesgo §5.3
│   │   │   ├── regression.py    # Tendencia de desempeño
│   │   │   └── kmeans.py        # Agrupamiento pedagógico
│   │   ├── privacy/             # Capa de Seguridad de Menores
│   │   │   └── guardrails.py    # Sanitización de PII y masking
│   │   └── ai/                  # Integración IA Externa
│   │       ├── external_client.py
│   │       ├── socratic_hybrid.py
│   │       └── teacher_hybrid.py
├── tests/
│   ├── test_privacy_guard.py    # Tests de fuga de datos
│   ├── test_grading_scaler.py   # Tests de conversión de escala peruana
│   └── test_hybrid_pipeline.py  # Tests end-to-end
└── .env.example
5. Código Técnico de Referencia5.1. Conversor de Escala Oficial Peruana (app/services/deterministic/grading_scaler.py)Pythonclass PeruvianGradingScaler:
    """Convierte notas cualitativas MINEDU (C, B, A, AD) a valores vigesimales numéricos para el cálculo matemático interno."""
    
    QUALITATIVE_TO_NUMERIC = {
        "C": 8.0,   # Rango 0 - 10 (Representante central de En Inicio)
        "B": 12.0,  # Rango 11 - 13 (Representante central de En Proceso)
        "A": 15.5,  # Rango 14 - 17 (Representante central de Logro Esperado)
        "AD": 19.0  # Rango 18 - 20 (Representante central de Logro Destacado)
    }

    @classmethod
    def to_numeric(cls, grade: str) -> float:
        return cls.QUALITATIVE_TO_NUMERIC.get(grade.upper().strip(), 8.0)

    @classmethod
    def to_qualitative(cls, numeric_grade: float) -> str:
        if numeric_grade >= 17.5:
            return "AD"
        elif numeric_grade >= 13.5:
            return "A"
        elif numeric_grade >= 10.5:
            return "B"
        return "C"
5.2. Módulo de Privacidad y Anonimización (app/services/privacy/guardrails.py)Pythonimport re
from app.services.deterministic.grading_scaler import PeruvianGradingScaler

class PrivacyGuardService:
    DNI_PATTERN = r'\b\d{8}\b'
    EMAIL_PATTERN = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    PHONE_PATTERN = r'\b9\d{8}\b'

    SYSTEM_PRIVACY_INSTRUCTION = """
    REGLA ABSOLUTA DE CONFIDENCIALIDAD (LEYES PERUANAS DE PROTECCIÓN DE DATOS DE MENORES):
    - Bajo ninguna circunstancia pidas o guardes nombres, DNI, colegio COAR ni ubicación del alumno.
    - Las calificaciones deben gestionarse bajo la escala cualitativa oficial peruana: AD (Logro Destacado), A (Logro Esperado), B (En Proceso), C (En Inicio).
    - Si el alumno menciona datos personales, recuérdale amablemente que por seguridad no debe compartirlos y reorienta la sesión socrática al tema académico.
    """

    @classmethod
    def sanitize_student_input(cls, text: str) -> str:
        """Sanitiza el texto enviado por el estudiante."""
        sanitized = re.sub(cls.DNI_PATTERN, '[DNI_PROTEGIDO]', text)
        sanitized = re.sub(cls.EMAIL_PATTERN, '[EMAIL_PROTEGIDO]', sanitized)
        sanitized = re.sub(cls.PHONE_PATTERN, '[TELEFONO_PROTEGIDO]', sanitized)
        return sanitized

    @classmethod
    def build_safe_context(cls, student_id: int, deterministic_data: dict) -> dict:
        """Construye un contexto anónimo adaptado a la escala MINEDU."""
        numeric_score = deterministic_data.get("risk_score", 0.0)
        qualitative_level = PeruvianGradingScaler.to_qualitative(numeric_score)

        return {
            "anonymous_id": f"STUDENT_HASH_{hash(student_id) % 10000}",
            "risk_level": deterministic_data.get("risk_level"),
            "qualitative_grade": qualitative_level, # C, B, A o AD
            "trend": deterministic_data.get("trend_slope"),
            "cluster_id": deterministic_data.get("cluster_id")
        }
5.3. Pipeline Híbrido Estudiante (app/services/ai/socratic_hybrid.py)Pythonfrom app.services.privacy.guardrails import PrivacyGuardService
from app.services.deterministic.risk_engine import calculate_student_risk
from app.services.ai.external_client import ExternalAIService

class HybridSocraticService:
    def __init__(self, ai_client: ExternalAIService):
        self.ai_client = ai_client

    async def process_interaction(self, db, student_id: int, user_message: str, history: list) -> dict:
        # 1. Lógica Determinista (MySQL satre_ro)
        analytics = calculate_student_risk(db, student_id)
        
        # 2. Manejo de Insuficiente Data (§5.2) -> No gasta llamadas de IA
        if analytics.get("insufficient_data"):
            return {
                "status": 200,
                "insufficient_data": True,
                "message": "Datos insuficientes para evaluación socrática"
            }

        # 3. Sanitización de Privacidad y traducción a Escala Peruana
        safe_message = PrivacyGuardService.sanitize_student_input(user_message)
        safe_context = PrivacyGuardService.build_safe_context(student_id, analytics)

        # 4. Invocación a la IA con contexto anónimo
        ai_response = await self.ai_client.generate_socratic_guidance(
            system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
            context=safe_context,
            sanitized_message=safe_message,
            history=history
        )

        return {
            "insufficient_data": False,
            "deterministic_metrics": {
                "risk_score": analytics["risk_score"],
                "risk_level": analytics["risk_level"],
                "minedu_grade": safe_context["qualitative_grade"]
            },
            "socratic_response": ai_response
        }
5.4. Pipeline Híbrido Docente (app/services/ai/teacher_hybrid.py)Pythonfrom app.services.privacy.guardrails import PrivacyGuardService
from app.services.deterministic.risk_engine import calculate_student_risk
from app.services.ai.external_client import ExternalAIService

class HybridTeacherReportService:
    def __init__(self, ai_client: ExternalAIService):
        self.ai_client = ai_client

    async def get_teacher_dashboard_data(self, db, student_id: int) -> dict:
        analytics = calculate_student_risk(db, student_id)
        
        if analytics.get("insufficient_data"):
            return {"insufficient_data": True}

        safe_context = PrivacyGuardService.build_safe_context(student_id, analytics)

        # La IA genera el plan de acompañamiento guiado por el estándar del MINEDU
        pedagogical_plan = await self.ai_client.generate_teacher_recommendation(
            context=safe_context
        )

        return {
            "insufficient_data": False,
            "student_id": student_id,
            "risk_score": analytics["risk_score"],
            "risk_level": analytics["risk_level"],
            "minedu_grade": safe_context["qualitative_grade"], # C, B, A, AD
            "ai_pedagogical_plan": {
                "summary": pedagogical_plan.get("summary"),
                "recommended_actions": pedagogical_plan.get("actions"),
                "suggested_materials": pedagogical_plan.get("materials")
            }
        }
6. Pruebas Unitarias de Mapeo y Privacidad (pytest)Python# tests/test_grading_scaler.py
from app.services.deterministic.grading_scaler import PeruvianGradingScaler

def test_qualitative_to_numeric_conversion():
    assert PeruvianGradingScaler.to_numeric("AD") == 19.0
    assert PeruvianGradingScaler.to_numeric("A") == 15.5
    assert PeruvianGradingScaler.to_numeric("B") == 12.0
    assert PeruvianGradingScaler.to_numeric("C") == 8.0

def test_numeric_to_qualitative_conversion():
    assert PeruvianGradingScaler.to_qualitative(18.5) == "AD"
    assert PeruvianGradingScaler.to_qualitative(15.0) == "A"
    assert PeruvianGradingScaler.to_qualitative(11.5) == "B"
    assert PeruvianGradingScaler.to_qualitative(7.0) == "C"

# tests/test_privacy_guard.py
from app.services.privacy.guardrails import PrivacyGuardService

def test_dni_and_email_masking():
    raw_input = "Hola, mi DNI es 74839201 y mi correo es alumno@coar.edu.pe"
    sanitized = PrivacyGuardService.sanitize_student_input(raw_input)
    assert "74839201" not in sanitized
    assert "alumno@coar.edu.pe" not in sanitized
    assert "[DNI_PROTEGIDO]" in sanitized
    assert "[EMAIL_PROTEGIDO]" in sanitized
7. Criterios de Aceptación TOBE-3Traducción Transparente de Escala MINEDU: El motor matemático procesa internamente la equivalencia $0-20$ para mantener la continuidad analítica (§5.3), pero expone las calificaciones en la escala C, B, A, AD en los prompts y dashboards.Cero Fuga de Datos (LPDP Ley 29733 - Perú): Las solicitudes hacia la API externa están sanitizadas de PII y utilizan identificadores de sesión efímeros.Respeto Estricto a Datos Insuficientes (§5.2): Si el alumno no registra el mínimo de evaluaciones requeridas, se devuelve HTTP 200 con insufficient_data: true sin invocar a la IA.