# SATRE · COAR Junín — Documento maestro TO-BE

> Fuente única de verdad. Unifica: levantamiento de información, checklist MVP, arquitectura Laravel↔Python y el código actual (AS-IS). En Cursor: referenciar con `@SATRE_TOBE.md` y una sola sección por prompt (ej. "implementa §4.2").

---

## 0. Decisiones de diseño (resuelven contradicciones entre las fuentes)

| # | Tema | Decisión | Por qué |
| --- | --- | --- | --- |
| D1 | Cómo lee datos Python | **Lectura directa a MySQL con usuario de solo lectura** (SQLAlchemy + Pandas), como pide el levantamiento. Laravel es el **único** cliente de Python. | Menos código y menos tokens que un pipeline de snapshots. |
| D2 | Pipeline actual de snapshots (`FeatureConsolidationService` → job → FastAPI) | **Retirar** de la ruta de asistencia. Se reemplaza por un **batch nocturno** + consulta bajo demanda. | Hoy crea 1 snapshot + 1 job por registro de asistencia y bloquea la petición. |
| D3 | Framework Python | **FastAPI** (no Flask), `debug` apagado, clave interna `X-Internal-Key`. | Validación de esquemas, tipado, docs automáticas. |
| D4 | "IA" | **Determinista y explicable** (reglas ponderadas + regresión + KMeans). Árbol de decisión **solo cuando haya etiquetas históricas reales**. Sin LLM ni APIs externas. | Sin datos etiquetados no se puede entrenar un clasificador honestamente. |
| D5 | Escala de notas | **IB 1–7** (aprobatorio ≥ 4). Cambiar el `20` fijo actual. | La UI y el levantamiento usan IB. |
| D6 | Asistencia aula vs residencia | **Mantener tablas separadas** (`attendances`, `residential_presences`), no una tabla con `type`. | Ya existen, con reglas únicas distintas. |
| D7 | Registro de usuarios | `POST /auth/register` **no es público**: solo admin crea usuarios (alias de `POST /admin/users`). | Datos de menores. |
| D8 | Sesión frontend | Bearer token con **expiración** + `/auth/refresh` (rota token) + logout por inactividad. | Cubre "expiración y refresco" con mínimo cambio. |
| D9 | Equidad/sesgo (pantalla `AuditoriaEquidad`) | **Post-MVP.** Ocultar la pantalla hasta tener datos. | No hay sexo/procedencia ni etiquetas; con mock sería engañoso. |

---

## 1. Actores y matriz de permisos

Roles (slugs backend): `admin`, `teacher`, `monitor`, `student`, `guardian`. R = leer · C = crear · U = editar · D = borrar · "propio" = solo sus datos · "hijos" = estudiantes vinculados.

| Módulo | admin | teacher | monitor | student | guardian |
| --- | --- | --- | --- | --- | --- |
| Usuarios, aulas, cursos, periodos, matrículas, vínculos apoderado | CRUD | – | – | – | – |
| Asistencia de aula | R | CRU (sus cursos) | – | R propio | R hijos |
| Notas IB | R | CRU (sus cursos) | – | R propio | R hijos |
| Presencia nocturna | R | – | CRU | R propio | R hijos |
| Incidencias | R | R (su aula) | CRU | – | R hijos (resumen; sin detalle de salud) |
| Permisos de salida | R + resolver | – | R + resolver | C (solicita) | Aprobar / rechazar |
| Alertas y riesgo | R todo | R su aula | R residencial | R propio (nivel + recomendación) | R hijos |
| Intervenciones y seguimiento | CRU | CRU | CRU | – | R hijos |
| IA Docente (insights) | R | R | – | – | – |
| IA Tutor socrático | – | – | – | Usar | – |
| Reportes (rendimiento, grupo) | R | R su aula | – | R propio | R hijos |
| Auditoría y métricas | R | – | – | – | – |

Regla técnica: **Policy + middleware `role` en cada ruta**. Un test parametrizado (§9) recorre rol × endpoint.

---

## 2. Arquitectura TO-BE

```
[ React + Vite ] ──HTTPS/Bearer──► [ Nginx ] ──► [ Laravel 12 API ] ──► [ MySQL 8 ]
   (por rol)                                        │  ▲  │ queue/scheduler          ▲
                                                    │  │  └──► Supervisor workers    │ read-only
                                                    │  └─ resultados (ai_diagnostics)│
                                                    ▼                                │
                                           [ Python FastAPI ]  ─── SQLAlchemy+Pandas ┘
                                           (red interna, X-Internal-Key)
```

- El navegador **nunca** habla con Python.
- Python expone el puerto solo en `127.0.0.1` / red interna.
- Laravel guarda resultados en `ai_diagnostics` y `risk_predictions`; el frontend lee de Laravel (rápido, con permisos).
- Repos/carpetas: `satre-backend/`, `coar-alerta-frontend/`, `satre-analytics/` (nueva).

---

## 3. Modelo de datos (cambios sobre lo existente)

**Se mantiene:** roles, users, academic_periods, teachers, monitors, guardians, classrooms, students, guardian_student, courses, enrollments, attendances, grades, residential_presences, incidents, permission_requests, risk_predictions, risk_explanations, alerts, interventions, follow_ups, documents, audit_logs.

### 3.1 Migraciones nuevas (una sola migración de ajuste + una de tablas nuevas)

| Tabla | Cambio |
| --- | --- |
| `users` | + `must_change_password` bool default true, `password_changed_at` nullable |
| `attendances` | `status` ∈ `present, late, absent_justified, absent_unjustified` (migrar `justified`→`absent_justified`); índice `(student_id, academic_period_id)` |
| `grades` | + `criterion` char(1) A–D nullable, + `evaluation_date` date; `score` = entero 1–7; `max_score` default 7; índice `(student_id, course_id, evaluation_date)` |
| `incidents` | `category` ∈ `conducta, salud, emocional, convivencia`; `severity` ∈ `leve, moderada, grave`; + `resolved_at` nullable |
| `permission_requests` | `status` ∈ `pending_guardian, approved_guardian, approved, rejected, cancelled` |
| `risk_predictions` | + `factors` json (contribución por factor), + `data_coverage` decimal(3,2), + `insufficient_data` bool |
| **`ai_diagnostics`** (nueva) | `id, type` (`teacher_insight`\|`student_profile`), `student_id` nullable, `classroom_id` nullable, `academic_period_id`, `payload` json, `model_version`, `insufficient_data` bool, `generated_at` |
| **`tutor_sessions`** (nueva) | `id, student_id, course_id, topic, criterion, state` json, `status`, timestamps |
| **`tutor_messages`** (nueva) | `id, tutor_session_id, role` (`student`\|`tutor`), `content`, `meta` json, timestamps |

Todas las FK con `restrictOnDelete`; **soft deletes** en students, users, grades, incidents.

### 3.2 Base de datos y usuarios MySQL

- Usuario `satre_app` (lectura/escritura) para Laravel.
- Usuario `satre_ro` (**solo SELECT** sobre `attendances, grades, incidents, residential_presences, students, enrollments, courses, classrooms, academic_periods`) para Python. Nunca `root`.

---

## 4. Contrato de API (Laravel) — prefijo `/api`

Respuestas: JSON estándar. Listados con `paginate(15)` y `meta`. Errores: `{message, errors?}` con 400/401/403/404/422/429/500.

### 4.1 `/auth`

| Método | Ruta | Acceso | Notas |
| --- | --- | --- | --- |
| POST | `/auth/login` | público, throttle | devuelve `token`, `expires_at`, `user`, `must_change_password` |
| POST | `/auth/refresh` | auth | rota token |
| POST | `/auth/logout` | auth | revoca token |
| GET | `/auth/me` | auth |  |
| POST | `/auth/change-password` | auth | obligatorio si `must_change_password`; mín. 10 caracteres |
| POST | `/auth/forgot-password` | público, throttle | token temporal por correo (60 min) |
| POST | `/auth/reset-password` | público |  |
| POST | `/auth/register` | admin | alias de `POST /admin/users` (D7) |

### 4.2 `/admin` (solo `admin`)

| Recurso | Rutas |
| --- | --- |
| `users` | `apiResource` + `PATCH /users/{id}/toggle-active` + `POST /users/{id}/reset-password` |
| `classrooms` | `apiResource` (asignar tutor) |
| `courses` | `apiResource` (asignar docente, aula, periodo) |
| `periods` | `apiResource` + `POST /periods/{id}/set-current` |
| `enrollments` | `POST` (individual y masivo por CSV), `DELETE` |
| `guardians` | `POST /guardians/{id}/students` (vincular) |
| `metrics` | `GET /admin/metrics` (usuarios activos, cobertura de asistencia, alertas abiertas) |
| `audit-logs` | `GET` paginado con filtros usuario/acción/fecha |

### 4.3 `/academic`

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET/POST/PUT | `/attendances`, `/attendances/session` | admin(R), teacher |
| GET/POST/PUT | `/grades` | admin(R), teacher (sus cursos) |
| GET/POST/PUT | `/presences` | monitor, admin(R) |
| GET/POST/PUT | `/incidents` | monitor, teacher(R), admin(R) |
| GET/POST | `/permissions`; `PATCH /permissions/{id}/guardian`; `PATCH /permissions/{id}/resolve` | student crea; guardian responde; monitor/admin resuelven |
| GET | `/me/summary` | student, guardian (con `?student_id=`): promedios, asistencia, alertas |

Cada `store/update` de notas y asistencia → `AuditLogger` con valor anterior y nuevo (ya existe).

### 4.4 `/reports`

| Ruta | Acceso |
| --- | --- |
| `GET /reports/students/{id}/performance` | según §1 |
| `GET /reports/classrooms/{id}/analytics` | admin, teacher |
| `GET /reports/classrooms/{id}/export?format=pdf\|csv` | admin, teacher (botón "reporte de grupo") |

### 4.5 `/alerts`

| Ruta | Acceso |
| --- | --- |
| `GET /alerts` (filtrado por rol/aula) | según §1 |
| `PATCH /alerts/{id}` (`open→acknowledged→resolved`) | admin, teacher, monitor |
| `POST /alerts/{id}/interventions`, `POST /interventions/{id}/follow-ups` | admin, teacher, monitor |

### 4.6 `/ai-analytics` (puente a Python)

| Ruta | Acceso | Comportamiento |
| --- | --- | --- |
| `GET /ai-analytics/teacher/insights/{classroomId}` | teacher (su aula), admin | lee `ai_diagnostics`; si es viejo (>24 h) pide a Python y guarda |
| `GET /ai-analytics/students/{id}/risk` | teacher, monitor, admin; student/guardian (vista reducida) | lee `risk_predictions` |
| `POST /ai-analytics/student/socratic-tutor` | student | body: `course_id, topic, message?, session_id?` |
| `GET /ai-analytics/student/socratic-tutor/sessions` | student | historial |

`AnalyticsController` + `PythonAnalyticsClient` (timeout 8 s, `X-Internal-Key`, 1 reintento). Si Python cae → 200 con `{available:false}`; **nunca** 500 al usuario.

### 4.7 Flujo de fondo

- **Scheduler (`daily 02:00`)**: `RunRiskBatchJob` → `POST python /v1/batch/risk` → guarda `risk_predictions` + `ai_diagnostics` → `CreateAlertsFromRisk` (crea `Alert` si nivel `ALTO` y no hay una abierta del mismo estudiante; escala si pasa de `MEDIO` a `ALTO`).
- **Bajo demanda**: al abrir el dashboard del tutor, refresca solo su aula.
- Eventos `AttendanceRecorded`, `GradeRecorded`, `IncidentRecorded` → solo auditoría/notificaciones (no cálculo).

---

## 5. Motor Python (`satre-analytics/`)

### 5.1 Estructura

```
satre-analytics/
  app/main.py            # FastAPI, auth por X-Internal-Key
  app/db.py              # engine SQLAlchemy (usuario satre_ro), consultas parametrizadas
  app/features.py        # Pandas: construye features por estudiante
  app/risk.py            # scoring + explicación
  app/trend.py           # regresión de notas (numpy/scipy), R²
  app/clustering.py      # KMeans (perfiles)
  app/insights.py        # brechas por criterio IB + metodologías
  app/socratic.py        # máquina de estados del tutor
  app/catalog/methodologies.json
  app/catalog/scaffolds.json
  tests/
  requirements.txt  Dockerfile  .env.example
```

### 5.2 Endpoints internos

| Método | Ruta | Devuelve |
| --- | --- | --- |
| GET | `/health` | `{status:"ok"}` |
| GET | `/v1/students/{id}/risk?period_id=` | JSON de §5.4 |
| GET | `/v1/classrooms/{id}/insights?period_id=` | brechas + recomendaciones |
| POST | `/v1/batch/risk` | `{period_id, classroom_id?}` → lista de riesgos |
| POST | `/v1/socratic/next` | siguiente turno del tutor |

Reglas: **SQL siempre parametrizado** (`text()` con bind params, nunca f-strings); nulos manejados en Pandas; sin datos suficientes → `insufficient_data:true` con **HTTP 200**.

### 5.3 Algoritmo de riesgo (determinista y explicable)

Features del periodo actual: `unexcused_rate` (faltas injustificadas / registros), `tardiness_rate`, `night_presence_rate`, `grade_mean` (IB), `grade_slope` y `r2` (regresión lineal de notas por fecha), `incident_weighted_30d` (leve=1, moderada=2, grave=4).

Componentes normalizados 0–1 y pesos:

| Componente | Fórmula | Peso |
| --- | --- | --- |
| Inasistencia | `min(unexcused_rate / 0.20, 1)` | 0.25 |
| Nivel de notas | `clamp((4.5 − grade_mean) / 3.5, 0, 1)` | 0.25 |
| Tendencia | `clamp(−slope / 0.5, 0, 1)` solo si `n ≥ 4` y `r2 ≥ 0.3` | 0.20 |
| Incidencias | `min(incident_weighted_30d / 6, 1)` | 0.15 |
| Presencia nocturna | `min((1 − night_rate) / 0.15, 1)` | 0.10 |
| Tardanzas | `min(tardiness_rate / 0.25, 1)` | 0.05 |

`score = 100 × Σ(peso × componente)`. Si falta una fuente, se **excluye y se renormalizan pesos**; `data_coverage` = peso disponible. Niveles iniciales: `BAJO < 35` · `MEDIO 35–64` · `ALTO ≥ 65`. Escalamiento: incidencia **grave** de categoría `salud`/`emocional` en 7 días → mínimo `ALTO` con bandera `needs_human_review`. `insufficient_data = true` si hay \< 5 registros de asistencia **y** \< 3 notas.

> Umbrales y pesos son **valores de partida**: viven en `app/config.py` y deben calibrarse con el COAR. Corregir el bug del ejemplo del levantamiento: promedio `0.0` cuando no hay notas **no** debe contar como riesgo alto.

### 5.4 Contrato JSON de riesgo

```json
{
  "student_id": 12, "period_id": 3, "model_version": "rules-1.0",
  "insufficient_data": false, "data_coverage": 0.9,
  "risk_level": "MEDIO", "risk_score": 48.2,
  "factors": [
    {"key": "unexcused_absence", "label": "Inasistencias injustificadas", "value": 0.12, "contribution": 15.0},
    {"key": "grade_level", "label": "Promedio IB", "value": 4.1, "contribution": 8.6}
  ],
  "recommendation": "Monitoreo preventivo: ...",
  "needs_human_review": false,
  "profile_cluster": "asistencia_irregular"
}
```

### 5.5 Otros módulos analíticos

- **Tendencia:** `scipy.stats.linregress` sobre notas ordenadas por `evaluation_date`; devuelve pendiente, R² y `n`.
- **Perfil (clustering):** KMeans (k=3) sobre features estandarizadas, **solo si hay ≥ 30 estudiantes** con datos; si no, `profile_cluster:null`. Etiquetas por inspección de centroides.
- **Árbol de decisión:** fuera del MVP; se activa cuando existan resultados históricos (retiros/repitencia) para entrenar y medir recall.
- **Insights docente:** por aula y curso, promedio y % de estudiantes \< 4 **por criterio A–D**; top 3 brechas; matriz de "errores" (criterio × estudiante); cada brecha se cruza con `methodologies.json` (p. ej. práctica de recuperación, aprendizaje entre pares, retroalimentación formativa). *Confirmar con el COAR la rúbrica real de criterios por asignatura.*
- **Tutor socrático (sin LLM):** máquina de estados `diagnóstico → pregunta guía → pista nivel 1/2/3 → verificación → reflexión SRL` guiada por `scaffolds.json` (por asignatura/tema). **Nunca entrega la solución final.** Prefiere verificación por opciones; el texto libre se evalúa por palabras clave. Limitación: no "entiende" lenguaje libre; el catálogo debe ser curado por docentes.

### 5.6 Seguridad del servicio

`X-Internal-Key` obligatorio (comparación en tiempo constante) · escucha solo en red interna · usuario MySQL de solo lectura · límite de tamaño de body · logs sin datos personales.

---

## 6. Frontend (React + Vite)

### 6.1 Infraestructura transversal (se construye una vez)

- `api/client.js`: manejo global de 401 (logout + redirección), 403 (toast), 422 (errores por campo), 429, red caída.
- Hook genérico `useApi(fn, deps)` → `{data, loading, error, reload}` y `useMutation`.
- Componentes: `Skeleton`, `Toast`, `ConfirmModal`, `EmptyState`, `Pagination`, `Field` (formularios con errores), `Forbidden (403)`, `NotFound (404)`.
- `ProtectedRoute` redirige al home del rol; sesión se borra por completo en logout y por inactividad (30 min).
- Pantalla **cambio de contraseña obligatorio** en primer ingreso.
- Responsive **mobile-first** en Tutor y Monitor (tablas → tarjetas en móvil).
- Eliminar `MOCK_USERS`, `data/*.js` y `RoleSwitcher` (o restringirlo a `import.meta.env.DEV` con backend de pruebas).

### 6.2 Pantallas por rol

| Rol | Pantallas |
| --- | --- |
| Admin | Dashboard métricas · Usuarios · Aulas · Cursos/asignaciones · Periodos · Matrículas · Auditoría |
| Docente/Tutor | Dashboard de riesgo del aula · Asistencia por clase (masiva) · Notas IB (criterios A–D, 1–7) · Reporte de grupo (PDF/CSV) · IA Docente (brechas y metodologías) · Alertas e intervenciones |
| Estudiante | Dashboard (promedios, asistencia, historial de alertas) · Calificaciones · Asistencia · Permisos · IA Tutor (chat guiado) |
| Monitor | Checklist de presencia nocturna · Incidencias (médicas/conducta) · Permisos · Alertas residenciales |
| Apoderado | Resumen del hijo/a · Autorizar permisos |

---

## 7. Requisitos transversales

**Seguridad:** bcrypt (`BCRYPT_ROUNDS=12`) o Argon2id · tokens con expiración (8 h) · `throttle` en login/forgot · Form Requests en todo `store/update` · CORS solo al dominio del frontend · cabeceras de seguridad (HSTS, CSP, X-Frame-Options) · `APP_DEBUG=false` · secretos solo en `.env` del servidor.

**Legal (Ley 29733):** consentimiento informado del apoderado (menores) registrado con fecha/versión (`consents` table o campo en `guardians`) · aviso de privacidad visible · política de retención · acceso a datos sensibles (salud/emocional) solo por rol necesario y auditado · gestionar inscripción del banco de datos personales ante la autoridad. *Requiere revisión legal; el código solo habilita.*

**Rendimiento:** paginación 15 en todos los listados · `with()` para evitar N+1 · índices de §3 · consultas de reportes con `select` de columnas necesarias · `DB::transaction()` en cargas masivas.

**Auditoría:** toda alta/modificación de notas, asistencia, incidencias y permisos guarda usuario, valor anterior, valor nuevo, IP y fecha; también lecturas de incidencias de salud.

**Errores:** JSON estandarizado en Laravel; en Python, `insufficient_data` en vez de 500.

---

## 8. Despliegue y operación

| Pieza | Decisión |
| --- | --- |
| Servidor | VPS (Hetzner/DigitalOcean/AWS) Ubuntu LTS |
| Web | Nginx → PHP-FPM (Laravel) y estáticos de `npm run build`; HTTPS con Let's Encrypt (certbot) |
| Procesos | **Supervisor**: `queue:work` y `uvicorn` (Python); `cron` para `schedule:run` |
| Empaquetado | `docker-compose.yml` opcional (nginx, php-fpm, mysql, python, worker) para reproducir local y prod |
| DB | MySQL gestionado o local con `mysqldump` diario a S3/almacenamiento externo, **con prueba de restauración mensual** |
| CI | GitHub Actions: `pint`, `php artisan test`, `pytest`, `npm run lint && npm run build` |
| Observabilidad | logs rotados, `/up` y `/health` monitoreados, alertas de cola fallida (`failed_jobs`) |
| Entornos | `local` → `staging` → `production` con `.env` separados |

---

## 9. Definición de "listo" (MVP vendible)

**Funcional**

- [ ] Login por 5 roles + cambio obligatorio de contraseña + recuperación por correo.
- [ ] Docente: asistencia masiva por clase, notas IB 1–7 con criterios, reporte de grupo PDF/CSV.
- [ ] Estudiante: dashboard con promedios, asistencia e historial de alertas; IA Tutor operativa.
- [ ] Monitor: checklist nocturno móvil, incidencias, permisos.
- [ ] Apoderado: ve rendimiento del hijo y autoriza permisos.
- [ ] Admin: CRUD usuarios/aulas/cursos/periodos/matrículas + auditoría + métricas.
- [ ] Motor: riesgo con factores explicados, `insufficient_data`, insights docentes, alertas automáticas sin duplicados.
- [ ] Cero pantallas con datos simulados.

**Calidad**

- [ ] Test parametrizado **rol × endpoint** (403 donde corresponda) pasa al 100 %.
- [ ] Tests de reglas de riesgo con casos borde (sin notas, sin asistencia, grave-salud).
- [ ] Sin N+1 (verificado en endpoints de listado); listados paginados.
- [ ] Lighthouse móvil aceptable en pantallas de Tutor y Monitor.

**Seguridad y legal**

- [ ] `.env` fuera del repo, `APP_DEBUG=false`, HTTPS, CORS cerrado, Python inaccesible desde internet.
- [ ] Consentimiento de apoderados registrado; política de privacidad publicada.
- [ ] Backup diario y restauración probada.

**Operación**

- [ ] Deploy documentado en un comando; workers bajo Supervisor; CI verde.
- [ ] **Piloto de 4–6 semanas** con un aula real y ajuste de umbrales con el equipo COAR.

---

## 10. Plan de construcción en Cursor (mínimo de tokens)

### 10.1 Reglas para gastar poco

1. **Contexto fijo y corto:** este documento + `.cursor/rules/satre.mdc` (siempre activa). No repegar la arquitectura en cada prompt.
2. **`.cursorignore`:** `vendor/`, `node_modules/`, `dist/`, `storage/`, `*.sqlite`, `.env`, `*.log`, `composer.lock`, `package-lock.json`.
3. **Un chat nuevo por fase** (los chats largos arrastran contexto y cuestan más). Cierra cada fase con commit.
4. **Prompts de una sola sección:** "Implementa `@SATRE_TOBE.md` §4.3 grades. Copia el patrón de `AttendanceService`."
5. **Generadores primero:** `php artisan make:model -mfc --policy --requests`, `make:resource`, `make:test` antes de pedir código. La IA solo rellena.
6. **Patrón único replicado:** Controller delgado → FormRequest → Service → Resource → Policy → Test. Pide "misma estructura que asistencia".
7. **Tests como especificación:** pide el test primero y luego "haz pasar el test"; evita reescrituras.
8. **Modelo barato para boilerplate** (CRUD, formularios, tablas) y **modelo fuerte solo para** diseño de migraciones, motor Python y seguridad.
9. **Frontend genérico:** construir `useApi`, `DataTable`, `Field`, `Pagination` una vez; luego cada pantalla es \~40 líneas.
10. **Pide diffs, no archivos completos:** "modifica solo lo necesario, no reescribas el archivo".
11. **No pidas "todo el sistema".** Un prompt = un entregable verificable con comando (`php artisan test --filter=...`).

### 10.2 Fases y prompts

| Fase | Entregable | Prompt (usar tal cual, en chat nuevo) | Verificación |
| --- | --- | --- | --- |
| **F0** Higiene | `.cursorignore`, `.env` fuera, mocks sin claves | "Aplica `@SATRE_TOBE.md` §6.1 (último punto) y §7 Seguridad. Quita `MOCK_USERS` con contraseñas y limita `RoleSwitcher` a DEV." | `npm run build` |
| **F1** Datos | migraciones §3 + seeders | "Crea las migraciones de `@SATRE_TOBE.md` §3.1 y ajusta modelos, factories y seeders. No toques controladores." | `php artisan migrate:fresh --seed && php artisan test` |
| **F2** Auth | §4.1 completo | "Implementa `@SATRE_TOBE.md` §4.1 con Sanctum: expiración, refresh, change-password, forgot/reset. Tests incluidos." | tests Auth |
| **F3** RBAC | matriz §1 como test | "Crea un test parametrizado rol×endpoint según `@SATRE_TOBE.md` §1 y §4 (los no implementados quedan `skipped`)." | test rojo→verde por fase |
| **F4** Admin | §4.2 | "Implementa §4.2 con `apiResource`, FormRequest, Resource, Policy y paginación. Sigue el patrón de asistencia." | tests Admin |
| **F5** Académico | §4.3 | "Implementa grades, presences, incidents y permissions (§4.3). Notas IB 1–7 validadas; audita valor anterior/nuevo." | tests Academic |
| **F6** Retirar pipeline | D2 | "Aplica decisión D2: elimina la consolidación por petición y su job/listener; conserva eventos para auditoría." | tests verdes |
| **F7** Python | `satre-analytics/` | "Crea el servicio de `@SATRE_TOBE.md` §5 completo con pytest. SQL parametrizado, `insufficient_data`, sin LLM." | `pytest` |
| **F8** Puente | §4.6–4.7 | "Implementa `PythonAnalyticsClient`, `AnalyticsController`, batch nocturno y `CreateAlertsFromRisk` sin duplicar alertas (§4.7)." | tests con `Http::fake` |
| **F9** Frontend base | §6.1 | "Construye la infraestructura de §6.1 (client, useApi, componentes, 403/404, cambio de contraseña)." | lint + build |
| **F10** Frontend por rol | §6.2 | **Un prompt por rol:** "Conecta las pantallas del rol X de §6.2 a la API real, elimina sus mocks, responsive." | Cypress por rol |
| **F11** Tutor y reportes | §5.5, §4.4 | "Implementa el chat socrático (front+back) y el reporte de grupo PDF/CSV." | tests + prueba manual |
| **F12** Producción | §8 | "Genera `docker-compose.yml`, configs Nginx/Supervisor, script de backup y workflow de CI según §8." | deploy en staging |
| **F13** Piloto | §9 | (Sin código) UAT con un aula, calibrar umbrales de §5.3, cerrar checklist. | checklist §9 |
| **F14** Metodología CREATE-SATRE | §12 | **4 prompts, ver §12.6:** modelo de datos → CRUD docente (paso 1-2) → flujo estudiante (paso 3-4) → conexión paso 5 con tutor. | tests + prueba manual |

Orden crítico: **F1 → F2 → F3** primero (todo lo demás cuelga de eso). F7 puede hacerse en paralelo con F4–F5 usando datos de seeder. F14 depende de F5 (grades/criterios) y F11 (tutor ya conectado) — hazla después de esas dos.

### 12.6 Prompts de F14 (uno por chat nuevo)

**F14.1 — Modelo de datos** (`satre-backend`):

```
Contexto: @SATRE_TOBE.md §12.2 (metodología CREATE-SATRE) y §3 (convenciones de modelo de datos)
Patrón: @database/migrations/2026_09_15_230300_create_intelligence_and_followup_tables.php

Crea las migraciones y modelos para los 5 pasos de §12.2:
- reading_materials: id, course_id, title, criterion (A-D nullable), content/url, created_by (teacher), timestamps
- student_artifacts: id, reading_material_id, student_id, nodes (json), connections (json), timestamps
- guided_questions: id, reading_material_id, prompt, type (multiple_choice|short), options (json nullable), correct_answer, timestamps
- guided_responses: id, guided_question_id, student_id, response, is_correct, timestamps
- quiz_attempts: id, reading_material_id, student_id, score, total_questions, correct_count, completed_at, timestamps

FK con restrictOnDelete, soft deletes en reading_materials y student_artifacts. No toques tutor_sessions/tutor_messages (ya existen). No crees controladores todavía.
```

**F14.2 — CRUD docente (pasos 1-2)** (`satre-backend`):

```
Contexto: @SATRE_TOBE.md §12.2 fila 1-2
Patrón: @app/Http/Controllers/AttendanceController.php @app/Services/AttendanceService.php @app/Policies/AttendancePolicy.php

Implementa GET/POST/PUT /academic/readings (teacher crea/edita reading_materials de sus cursos, admin lee todo) y GET/POST /academic/readings/{id}/artifacts (estudiante sube su student_artifacts, solo valida que nodes/connections no estén vacíos, sin calificación automática). Mismo patrón Controller→FormRequest→Service→Resource→Policy→Test. Paginación 15. Agrega estos endpoints a tests/Feature/RoleEndpointMatrixTest.php.
```

**F14.3 — Flujo estudiante pasos 3-4** (`satre-backend`):

```
Contexto: @SATRE_TOBE.md §12.2 fila 3-4 y §12.3 (sin datos sensibles hacia la IA)
Patrón: mismo de F14.2

Implementa GET/POST /academic/readings/{id}/questions (guided_questions/guided_responses, feedback inmediato correcto/incorrecto por reglas) y POST /academic/readings/{id}/quiz (quiz_attempts, calcula score). Solo rol student crea respuestas; teacher/admin leen agregados. Tests incluidos, agrega a RoleEndpointMatrixTest.
```

**F14.4 — Conexión paso 5 con el tutor + frontend** (`coar-alerta-frontend`, chat nuevo):

```
Contexto: @SATRE_TOBE.md §12.2 fila 5 y §6.1 (componentes genéricos ya existentes)
Archivos: @src/pages/estudiante/IATutor.jsx @src/api/

Agrega al flujo del estudiante: tras completar el quiz (paso 4) de un reading_material, ofrece iniciar sesión de tutor socrático (ya implementado) pre-cargada con el topic del reading_material, usando POST /ai-analytics/student/socratic-tutor existente. No dupliques lógica del tutor, solo conéctalo como "paso siguiente" tras el quiz. Usa useApi/useMutation/Toast/Skeleton ya existentes.
```

---

## 11. Lo que el código no resuelve (riesgos reales)

1. **Umbrales sin calibrar:** el motor parte de reglas razonables, no de evidencia del COAR. El piloto es obligatorio antes de tomar decisiones sobre estudiantes.
2. **Sin resultados históricos** no hay modelo predictivo validable (recall); solo scoring de reglas.
3. **Tutor socrático sin LLM** es acotado: la calidad depende del catálogo que curen los docentes.
4. **Cumplimiento legal** (consentimiento, registro del banco de datos, contratos con el COAR) exige revisión de un abogado.
5. **"Listo para el mercado"** incluye soporte, capacitación, SLA y respaldo operativo; nada de eso se genera con código.

---

## 12. Metodología de aprendizaje y evaluación con IA (CREATE-SATRE)

> Marco pedagógico que se monta sobre lo ya construido (criterios IB A–D, tutor socrático §5.5, motor de riesgo §5.3). No reemplaza nada de lo anterior — añade un flujo de 5 pasos por tema/artículo que alimenta el mismo motor de riesgo con una señal nueva: desempeño por proceso, no solo notas sueltas.

### 12.1 Origen y encuadre

Basado en el método **CREATE** (Hoskins et al., 2007) para trabajar artículos científicos, combinado con el principio de **evaluación por proceso** (en vez de evaluar solo el producto final, se evalúa cómo el estudiante llegó a la respuesta) y encuadrado como un caso de **Learning Analytics** (la intersección entre sistemas, datos y educación en la que ya vive SATRE). El paso 5 es deliberadamente "resistente a la IA": pedir que el estudiante proponga su propia pregunta de investigación es mucho más difícil de resolver copiando una respuesta generada que un examen de opción múltiple.

### 12.2 Los 5 pasos y su mapeo técnico

| Paso | Qué hace el estudiante | Rol de la IA (motor de reglas, D4) | Entidad de datos | Endpoint |
| --- | --- | --- | --- | --- |
| 1. Consider | Lee el contexto del artículo/tema asignado por el docente | Ninguno — banco curado por docente | `reading_materials` (nueva) | `GET /academic/readings/{courseId}` |
| 2. Read + gráfico | Resume el artículo y arma su propio mapa conceptual/diagrama | Puede sugerir estructura del gráfico (plantilla), nunca la resuelve | `student_artifacts` (nueva, JSON de nodos/conexiones, no archivo libre) | `POST/GET /academic/readings/{id}/artifacts` |
| 3. Elucidar hipótesis | Responde preguntas guía (opción múltiple o corta) sobre qué plantea el artículo | Genera las preguntas a partir del tema/criterio IB (catálogo curado, igual que `scaffolds.json`) | `guided_questions` + `guided_responses` (nuevas) | `GET/POST /academic/readings/{id}/questions` |
| 4. Analizar (quiz) | Resuelve un quiz interactivo sobre el tema | Feedback inmediato correcto/incorrecto + por qué (reglas, no LLM) | `quiz_attempts` (nueva) | `POST /academic/readings/{id}/quiz` |
| 5. Pensar el siguiente paso | Propone su propia pregunta/experimento nuevo a partir de lo leído | El tutor socrático (§5.5) guía con pistas progresivas, nunca da la respuesta final | `tutor_sessions`/`tutor_messages` (ya existen, §3.1) | ya definido en §4.6 |

### 12.3 Principio de datos sensibles

Ningún paso envía texto libre con datos personales del estudiante al motor de IA. Lo que viaja hacia el tutor y hacia el quiz es **tema + criterio IB + respuesta estructurada**, nunca nombre, incidencias ni información de salud — mismo principio que D1 (Python solo lee lo necesario) aplicado aquí al contenido de las preguntas.

### 12.4 Integración con el motor de riesgo existente

El resultado agregado de los pasos 3–5 (porcentaje de aciertos por criterio IB, si completó o no el paso 5) se guarda como una fuente más de `grades`/`ai_diagnostics`, **sin crear un segundo motor de riesgo**: se suma como insumo a `FeatureConsolidationService` (§5.3), igual que notas e incidencias. No cambia la fórmula de riesgo en este documento — eso se define cuando haya datos reales del piloto.

### 12.5 Alcance de este MVP (qué entra y qué no)

**Entra (F14):** modelo de datos de los 5 pasos, CRUD de `reading_materials` para el docente, flujo completo del estudiante (pasos 1–5), conexión del paso 5 con el tutor ya existente. **No entra todavía:** calificación automática de mapas conceptuales/gráficos (paso 2) más allá de validar que tiene nodos y conexiones — la evaluación cualitativa la hace el docente; integración con el motor de riesgo como fuente ponderada (se revisa en el piloto, §9/§13).