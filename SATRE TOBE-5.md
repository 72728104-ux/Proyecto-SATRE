# SATRE COAR — Especificación Técnica TOBE-5 (SaaS Comercial de Alta Fidelidad)

## 1. Visión y Limpieza de Arquitectura SaaS
Convertir SATRE en un SaaS de Alerta Temprana y Retención Estudiantil de grado comercial, eliminando código basura, datos hardcodeados y funciones fuera del alcance del core pedagógico (como matrícula directa). Toda funcionalidad debe ser dinámica, configurable por colegio (Tenant) y validada rigurosamente bajo la matriz de pruebas RTM.

---

## 2. Refactorización y Limpieza de Incoherencias (Zero Hardcode)

### A. Depuración del Módulo Admin
* **Eliminación de Matrícula:** Remover los accesos y vistas de "Matrícula" en el panel de Administrador. La matriculación pertenece a un ERP escolar externo; SATRE recibe estudiantes, aulas y matrículas activas mediante sincronización/seeder.
* **SaaS Toggle Dinámico (Internado y Asistencia Nocturna):**
  - Variable de entorno: `COLLEGE_HAS_RESIDENCE=true/false`
  - Si es `false`: Ocultar completamente los menús de 'Residencia', 'Pernocta', 'Alergias Comedor', 'Permisos Nocturnos' y la marcación de asistencia nocturna para el rol Monitor/Residencia.

### B. Gestión Autónoma de Sesiones por el Estudiante
* **Autonomía del IA Tutor:** Permitir que el estudiante elimine o archive sus propias sesiones de chat y borradores de artículos.
* **Ruta Backend:** Endpoint `DELETE /api/v1/socratic/sessions/{session_id}` que limpia el historial y libera memoria sin afectar las métricas agregadas de analítica.

---

## 3. Evolución de la IA Docente Híbrida (IA Asistente Pedagógico)

### A. Interactividad Híbrida para el Docente (Gemini API)
* Transformar el panel de "IA Docente" de reportes estáticos a un **Asistente Conversacional e Interactivo**:
  - Recomienda estrategias de intervención diferenciadas según la competencia Minedu/IB donde falla el alumno (Criterios A, B, C, D).
  - Sugiere actividades remedial para estudiantes en nivel de riesgo "Alto" o "Medio".
  - Genera resúmenes ejecutivos para reuniones con apoderados o tutores.
* **Resiliencia:** Reintentos automáticos `Http::retry(3, 1000)` con fallback a `gemini-1.5-flash` y sanitización estricta de respuestas.

---

## 4. Matriz de Calidad y Pruebas (Alineación con Plan de Pruebas 04/10/2026)

El sistema debe aprobar el 100% de las pruebas críticas especificadas en el Plan de Pruebas de Software:
* **Pruebas de Calificaciones y Alertas (Boundary & Minedu):** Cobertura completa de la escala vigesimal (0.00 a 20.00) y activación de alertas en umbrales exactos.
* **Seguridad y RBAC (Aislamiento IDOR):** Validación de que Apoderados y Estudiantes solo consulten su propia información (HTTP 403 en acceso cruzado).
* **PBT (Property-Based Testing en Python):** Invariantes del score de riesgo sin valores NaN, infinitos o desbordamientos.

---

## 5. Plan de Prompts de Ejecución para Cursor

Ejecuta los siguientes prompts paso a paso en el Composer de Cursor (`Ctrl + I`):

### PROMPT 1: Depuración de Módulos Incoherentes y SaaS Toggle de Residencia
```text
Contexto: SATRE TOBE-5 (SaaS Comercial Producción)
Involucra: @satre-backend, @coar-alerta-frontend y @SATRE-TOBE-5.md

Elimina funciones innecesarias y asegura la configurabilidad SaaS:
1. En @coar-alerta-frontend: Remueve las opciones de 'Matrícula' del menú y rutas del Administrador.
2. En @satre-backend: Revisa que la variable 'COLLEGE_HAS_RESIDENCE' desde config/app.php controle la entrega de endpoints de residencia.
3. En @coar-alerta-frontend: Si 'COLLEGE_HAS_RESIDENCE' es false, oculta los accesos de 'Residencia', 'Pernocta', 'Alergias' y 'Asistencia Nocturna' para todos los roles (Monitor, Docente, Estudiante).