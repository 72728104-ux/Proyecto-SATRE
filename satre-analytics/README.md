# satre-analytics

Motor analítico interno de SATRE (SATRE_TOBE §5). FastAPI + Pandas + scikit-learn, sin LLM ni APIs externas.

> **⚠️ No exponer a internet.** Este servicio debe escuchar solo en `127.0.0.1` o en una red interna
> (Docker/VPC). Laravel es su **único** cliente; el navegador nunca habla con él. No publicarlo en Nginx
> ni abrir el puerto en el firewall. Todas las rutas (incluida `/health`) exigen `X-Internal-Key`.

## Endpoints (§5.2)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/health` | `{status:"ok"}` |
| GET | `/v1/students/{id}/risk?period_id=` | contrato §5.4 (sin `period_id` usa el periodo actual) |
| GET | `/v1/classrooms/{id}/insights?period_id=` | brechas por criterio A–D + metodologías |
| POST | `/v1/batch/risk` | body `{period_id, classroom_id?}` → `{..., results: [contrato §5.4]}` |
| POST | `/v1/socratic/next` | body `{topic, course_id?, message?, option_id?, state?}` → siguiente turno |

Errores: `{message, errors?}` con 401 (sin clave o clave inválida), 404, 411/413 (body), 422, 503 (BD caída).
La falta de datos nunca es error: responde 200 con `insufficient_data: true`.

El tutor es sin estado en el servidor: Laravel guarda `state` en `tutor_sessions.state` y lo reenvía en cada turno.

## Seguridad (§5.6)

- `X-Internal-Key` comparada en tiempo constante (`hmac.compare_digest` sobre SHA-256); el servicio no arranca si `INTERNAL_KEY` tiene < 32 caracteres. Sin CORS: el navegador no es cliente.
- Usuario MySQL `satre_ro` con solo `SELECT`; además cada conexión se abre en `READ ONLY`.
- SQL solo como literales `text()` con bind params (`tests/test_sql_safety.py` lo verifica).
- Body limitado por `MAX_BODY_BYTES`; logs solo con método, plantilla de ruta, status y duración.
- Sin `/docs` ni `/openapi.json`.

Permisos MySQL mínimos:

```sql
CREATE USER 'satre_ro'@'127.0.0.1' IDENTIFIED BY '<contraseña>';
GRANT SELECT ON satre.attendances TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.grades TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.incidents TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.residential_presences TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.students TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.enrollments TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.courses TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.classrooms TO 'satre_ro'@'127.0.0.1';
GRANT SELECT ON satre.academic_periods TO 'satre_ro'@'127.0.0.1';
```

## Calibración

Pesos, umbrales, ventanas y estados viven en `app/config.py`. Son valores de partida y deben calibrarse con el COAR.
Decisiones tomadas donde §5.3 no precisa:

- Pendiente de tendencia en puntos IB **por 30 días** (`TREND_SLOPE_UNIT_DAYS`).
- Tendencia solo entra si `n ≥ 4` y `R² ≥ 0.3`; si no, se excluye y se renormalizan pesos.
- Incidencias siempre son fuente disponible (sin registros = 0 incidencias).
- Presencia nocturna solo para internos con registros `night`; `on_permission` no cuenta como ausencia.
- `absent` (estado heredado) se trata como injustificada hasta migrar a `absent_unjustified`.
- El escalamiento por incidencia grave de salud/emocional se aplica incluso con `insufficient_data`.

## Local

```powershell
cd satre-analytics
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env   # completar INTERNAL_KEY y DB_PASSWORD
python -m pytest
uvicorn app.main:app --host 127.0.0.1 --port 8001 --env-file .env --no-access-log
```

Docker (solo loopback): `docker build -t satre-analytics . && docker run --env-file .env -p 127.0.0.1:8001:8001 satre-analytics`
