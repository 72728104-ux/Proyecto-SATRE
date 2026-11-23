# Informe técnico de pruebas y calidad de software

|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |

Sistema Web de Alerta Temprana (SATRE) para el COAR Junín · Pruebas y Calidad de Software · Meza Matias Miguel Angel (72728104)

**UNIVERSIDAD CONTINENTAL**

**FACULTAD DE INGENIERÍA**

**ESCUELA ACADÉMICO PROFESIONAL DE INGENIERÍA DE SISTEMAS E INFORMÁTICA**

**INFORME TÉCNICO DE PRUEBAS Y CALIDAD DEL SOFTWARE**

Ejecución, automatización de pruebas y análisis de calidad con SonarQube

| Campo | Detalle |
| --- | --- |
| Proyecto evaluado | SATRE: Sistema Web de Alerta Temprana para el COAR Junín |
| Asignatura | Pruebas y Calidad de Software |
| Estudiante | Meza Matias Miguel Angel |
| Código | 72728104 |
| Docente / Asesor | \[INSERTAR\] |
| Fecha de entrega | \[INSERTAR\] |

HUANCAYO – PERÚ · 2026

## 1. Descripción del proyecto de software

| Campo | Descripción |
| --- | --- |
| Nombre del proyecto | SATRE: Sistema Web de Alerta Temprana para el COAR Junín |
| Objetivo del software | Dar soporte a la gestión de riesgo académico, asistencia, convivencia y seguimiento de estudiantes mediante alertas, reportes y analítica interna del COAR Junín. La evidencia real se observa en los módulos Laravel, los endpoints de riesgo y la capa FastAPI del repositorio. |
| Tecnologías utilizadas | Frontend: React 19.2.8 + Vite 8.2.2 + Vitest 5.0.3 + Cypress 16; Backend: PHP 8.2.12 + Laravel 12.0 + Composer 2.10.2; Analítica: Python 3.13.15 + FastAPI + pytest; Base de datos: MySQL 8.0 en Docker Compose; Contenedores: nginx, php-fpm, worker, scheduler, python y mysql definidos en docker-compose.yml. |
| Funcionalidades principales | Módulos reales detectados en el código: autenticación y perfil (`/api/auth`, `satre-backend/app/Http/Controllers/AuthController.php`), académico (`/api/grades`, `/api/attendances`, `/api/incidents`, `/api/presences`, `satre-backend/routes/api.php`), residencia y permisos (`/api/permissions`), reportes y alertas (`/api/reports`, `/api/alerts`), analítica AI (`/api/ai-analytics`, `satre-analytics/app`), administración (`/admin`), y vistas React en `coar-alerta-frontend/src/pages/` y `coar-alerta-frontend/src/components/`. |
| Entorno de ejecución | Entorno local con Docker Compose (`docker-compose.yml`), servicios `nginx`, `php-fpm`, `worker`, `scheduler`, `python` y `mysql`; el backend también puede ejecutarse con pruebas SQLite en memoria (`phpunit.xml`) para pruebas aisladas. La verificación local confirmó PHP 8.2.12, Node 26.7.0, npm 11.19.0 y Python 3.13.15. |
| Herramientas de pruebas | PHPUnit/Laravel (`php artisan test`), pytest (`satre-analytics/tests`), Vitest (`coar-alerta-frontend/package.json`), Cypress (`coar-alerta-frontend/cypress`), SonarQube con `sonar-project.properties`, y GitHub Actions en `.github/workflows/ci.yml`. |

## 2. Identificación y planificación de las pruebas

### 2.1. Tipos de pruebas seleccionados (mínimo 3)

| Tipo de prueba | Finalidad | Justificación para SATRE |
| --- | --- | --- |
| Prueba de API / integración backend | Validar contratos HTTP de autenticación, notas, asistencias, permisos e incidentes. | El backend expone endpoints críticos bajo reglas de negocio y permisos por rol; un fallo en estos endpoints compromete la operación del sistema. |
| Prueba de regresión analítica / riesgo | Confirmar que la capa FastAPI devuelve un contrato estable de riesgo y no rompe la estructura de salida. | La analítica de riesgo y la recomendación para estudiantes se basan en un contrato fijo; cualquier cambio rompe el consumo del backend y de los reportes. |
| Prueba de seguridad y autorización | Verificar que un perfil no pueda acceder o modificar datos de otros roles. | En SATRE existen restricciones por rol y por vinculación de apoderado/estudiante; el incumplimiento tiene impacto directo en privacidad y cumplimiento. |
| Prueba de UI end-to-end (Cypress) | Validar navegación y flujo principal del frontend con datos sintéticos. | El repositorio incluye configuración y especificaciones Cypress; esta ejecución no se realizó durante la validación del informe. |

### 2.2. Matriz del plan de pruebas

| ID | Funcionalidad o componente | Tipo de prueba | Procedimiento o escenario | Resultado esperado |
| --- | --- | --- | --- | --- |
| P01 | Registro de nota en escala MINEDU | Prueba de integración | POST `/api/grades` con `score=16.5` y `criterion=B` (archivo: `satre-backend/tests/Feature/AcademicModuleTest.php`) | La nota se registra, se calcula la literal `A` y se audita el cambio. |
| P02 | Validación de rango de nota | Prueba negativa | POST `/api/grades` con `score=-0.01` y `score=20.01` (mismo archivo) | El sistema responde `422` con `score` como error de validación. |
| P03 | Presencias y auditoría | Prueba de integración | POST `/api/presences` y PUT `/api/presences/{id}` con `status=present`/`absent` | Se crea la presencia, se actualiza y aparece en `audit_logs`. |
| P04 | Incidentes y permisos | Prueba de integración | POST `/api/incidents` con `category='convivencia'` y update con `severity='moderada'` | El incidente queda registrado y solo el monitor puede manejarlo. |
| P05 | Resolver permiso de salida del estudiante | Prueba positiva/negativa | POST `/api/permissions` y PATCH `/api/permissions/{id}/guardian` | El apoderado puede aprobarlo y el otro apoderado no puede hacerlo. |
| P06 | Restricción por rol del docente | Prueba de seguridad | GET/POST/PUT en `/api/grades` con un docente no autorizado | El sistema responde `403` y bloques el acceso a cursos ajenos. |
| P07 | Resumen del estudiante y apoderado | Prueba de integración | GET `/api/me/summary` y `/api/me/summary?student_id=` | El estudiante y su apoderado ven solo el resumen autorizado. |
| P08 | Privacidad de incidentes para apoderado | Prueba de seguridad | GET `/api/incidents` con usuario de guardian | El apoderado ve solo incidentes de sus estudiantes y sin descripción detallada. |
| P09 | Contrato de riesgo del estudiante | Prueba analítica | GET `/v1/students/1/risk?period_id=3` (archivo: `satre-analytics/tests/test_api.py`) | Devuelve `student_id`, `risk_level`, `risk_score`, `factors`, `recommendation` y `needs_human_review`. |
| P10 | Fallback de base de datos del analítico | Prueba de resiliencia | GET `/v1/classrooms/7/insights` cuando la BD falla | Devuelve `200` con `insufficient_data = true` sin error 500 ni 503. |
| P11 | Batch risk | Prueba de integración analítica | POST `/v1/batch/risk` con `{period_id: 3}` (mismo archivo) | Devuelve un arreglo `results` con el contrato esperado. |
| P12 | Flujo de navegación y sesión frontend | Prueba UI / E2E | Prueba unitaria de sesión en `coar-alerta-frontend/src/api/auth.test.js`; existe también `coar-alerta-frontend/cypress/e2e/navigation.cy.js` para navegación E2E. | La sesión se guarda y recupera correctamente; el flujo de navegación requiere una ejecución Cypress separada. |

## 3. Ejecución de las pruebas y resultados obtenidos

### 3.1. Preparación del entorno

| Verificación | Estado | Detalle o comando utilizado |
| --- | --- | --- |
| Proyecto operativo | Sí | Se validó con la ejecución real de `php artisan test --filter SeederEnvironmentTest` dentro de `satre-backend`, usando la configuración de pruebas de `phpunit.xml`. |
| Dependencias instaladas | Parcialmente verificadas | Backend y analítica se validaron al ejecutar sus pruebas. En frontend, el intento de `npm ci`/Vitest quedó bloqueado por `ECONNRESET` al consultar npm; no se confirma la ejecución de las pruebas frontend. |
| Base de datos y servicios disponibles | Sí, solo para pruebas | La base de pruebas del backend es SQLite en memoria configurada en `phpunit.xml` (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`); el servicio MySQL del `docker-compose.yml` queda definido para entorno local, no para la validación aislada del test. |
| Datos de prueba (seeders / factories) | Sí | `DatabaseSeeder` ejecuta `RoleSeeder` y, en `testing`, `InstitutionalUserSeeder` y demás seeders; la verificación se confirmó con `SeederEnvironmentTest`. |
| Herramientas configuradas | Parcialmente | PHP 8.2.12, Laravel 12, Node 26.7.0, npm 11.19.0 y Python 3.13.15 se observaron localmente. La ejecución de analítica se hizo con el entorno configurado del proyecto; ver versión reportada en `docs/evidencias/pytest.txt`. Pytest y Cypress están declarados/disponibles en el proyecto. |
| Condiciones iniciales de cada escenario | Sí | `APP_ENV=testing`, `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `QUEUE_CONNECTION=sync`, `SESSION_DRIVER=array`, y `SATRE_SEED_SECRET=coar2026`. |

Configuración relevante para reproducir las pruebas automatizadas: para backend, `satre-backend/phpunit.xml` configura SQLite en memoria; para analytics, `satre-analytics/pytest.ini` y `tests/conftest.py` definen el entorno; para frontend, `coar-alerta-frontend/vite.config.js` configura Vitest con `jsdom` y `cypress.config.js` define el patrón E2E. La preparación de un entorno reproducible no equivale a haber ejecutado todos los escenarios manuales de la matriz.

### 3.2. Fichas de ejecución de los casos de prueba

Copiar y completar una ficha por cada caso de la matriz (P01 a P12). Los campos "Resultado obtenido", "Estado" y "Evidencia" se llenan solo con lo observado en la ejecución real.

**Ficha P01**

| Campo | Descripción |
| --- | --- |
| Identificador | P01 |
| Funcionalidad evaluada | Registro de nota en la escala MINEDU |
| Tipo de prueba | Integración |
| Datos de entrada | `score=16.5`, `criterion=B`, `student_id` y `course_id` válidos |
| Procedimiento ejecutado | POST `/api/grades` con rol `teacher` |
| Resultado esperado | Crear la nota y registrar el evento de auditoría |
| Resultado obtenido | No ejecutado manualmente en esta validación. |
| Estado | Pendiente |
| Evidencia | No disponible; ejecutar el caso y adjuntar captura/reporte. |

**Ficha P02**

| Campo | Descripción |
| --- | --- |
| Identificador | P02 |
| Funcionalidad evaluada | Validación de rango de nota |
| Tipo de prueba | Negativa |
| Datos de entrada | `score=-0.01`, `score=20.01` |
| Procedimiento ejecutado | POST `/api/grades` con datos inválidos |
| Resultado esperado | Respuesta `422` por validación |
| Resultado obtenido | No ejecutado manualmente en esta validación. |
| Estado | Pendiente |
| Evidencia | No disponible; ejecutar el caso y adjuntar captura/reporte. |

&#91;Repetir la ficha hasta P12\]

### 3.3. Resumen cuantitativo de la ejecución manual

| Indicador | Resultado |
| --- | --- |
| Total de casos de prueba ejecutados | 0 casos manuales documentados en esta sesión; las suites automatizadas se resumen en 4.3. |
| Casos aprobados | No aplica: no se ejecutaron casos manuales. |
| Casos fallidos | No aplica: no se ejecutaron casos manuales. |
| Casos bloqueados | No aplica: no se ejecutaron casos manuales. |
| Porcentaje de aprobación | No calculable para pruebas manuales porque no hubo ejecución. |
| Incidencias identificadas | No evaluadas mediante ejecución manual. El bloqueo de npm se informa como limitación de entorno, no como defecto funcional. |

Porcentaje de aprobación = (Casos aprobados / Casos ejecutados) × 100. Los casos bloqueados que no llegaron a ejecutarse se registran por separado.

### 3.4. Defectos encontrados

| ID defecto | Caso relacionado | Descripción | Comportamiento observado | Severidad | Consecuencia posible | Acción correctiva |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | No se registraron defectos confirmados durante esta ejecución acotada. | — | — | — | No aplica; completar tras pruebas manuales y análisis Sonar. |

Análisis de los defectos: no se dispone de ejecución manual ni de informe Sonar para identificar y clasificar defectos en este documento. El error de red de npm impidió validar frontend, pero no demuestra un defecto del producto.

## 4. Implementación y ejecución de las pruebas automatizadas

### 4.1. Selección de las pruebas a automatizar

| Caso manual | Se automatiza | Justificación |
| --- | --- | --- |
| P03 | Sí | La creación y actualización de presencias es una regla funcional repetitiva y verificable por base de datos, con audit log asociado. |
| P05 | Sí | El flujo de permiso de salida tiene un punto de decisión crítico para un apoderado y se valida por rol. |
| P09 | Sí | El contrato del riesgo debe permanecer estable para evitar cambios de interfaz en la capa analítica. |
| P10 | Sí | El fallback ante error de base de datos es una condición de resiliencia importante y debe mantenerse. |
| P12 | Sí | El flujo de sesión en frontend es crítico para la experiencia del usuario y debe comprobarse automáticamente. |
| P01 | Sí | El registro de nota en escala MINEDU es una regla de negocio central y se repite frecuentemente. |

### 4.2. Herramientas e implementación

| Herramienta | Propósito | Nivel o capa que cubre |
| --- | --- | --- |
| PHPUnit / Laravel | ejecutar pruebas de API y reglas de negocio del backend | Backend / integración |
| Pytest | validar contrato y resiliencia del servicio analítico | Analítica / API interna |
| Vitest | validar módulos y componentes frontend con jsdom | Frontend / unitarias y componentes |
| Cypress | validar navegación y sesión del frontend | E2E / interfaz |

**Casos automatizados**

| ID automatizado | Caso manual | Archivo de la prueba | Qué verifica |
| --- | --- | --- | --- |
| A01 | P03 | `satre-backend/tests/Feature/AcademicModuleTest.php` | La presencia se crea y actualiza sin romper auditoría. |
| A02 | P05 | `satre-backend/tests/Feature/AcademicModuleTest.php` | El apoderado correcto aprueba y un apoderado ajeno queda bloqueado. |
| A03 | P09 | `satre-analytics/tests/test_api.py` | El contrato del riesgo mantiene la estructura y valores esperados. |
| A04 | P10 | `satre-analytics/tests/test_api.py` | La API devuelve 200 con `insufficient_data = true` cuando falla la BD. |
| A05 | P12 | `coar-alerta-frontend/src/api/auth.test.js` | La sesión se guarda, valida el token y elimina el estado si expira. |
| A06 | P01 | `satre-backend/tests/Feature/AcademicModuleTest.php` | La nota se registrar en escala y se actualiza con auditoría. |

**Código fuente de las pruebas** (pegar el código real que se ejecutó)

```php
// A02 - P05
public function test_guardian_cannot_approve_permission_for_other_student(): void
{
    $context = $this->academicContext();
    [$studentUser, $guardianUser] = $this->studentWithGuardian($context['student']);
    $otherGuardianUser = $this->userWithRole(Roles::GUARDIAN);
    Guardian::query()->create(['user_id' => $otherGuardianUser->id, 'document_number' => '20202020', 'first_name' => 'Otro', 'last_name' => 'Apoderado']);

    $permissionId = $this->actingAs($studentUser, 'sanctum')
        ->postJson(self::PERMISSIONS_ENDPOINT, [
            'type' => 'salida',
            'reason' => 'Cita médica',
            'starts_at' => '2026-04-18 08:00:00',
            'ends_at' => '2026-04-18 18:00:00',
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($otherGuardianUser, 'sanctum')
        ->patchJson(self::PERMISSIONS_ENDPOINT."/$permissionId/guardian", ['decision' => 'approved'])
        ->assertForbidden();

    $this->actingAs($guardianUser, 'sanctum')
        ->patchJson(self::PERMISSIONS_ENDPOINT."/$permissionId/guardian", ['decision' => 'approved'])
        ->assertOk()
        ->assertJsonPath('data.status', PermissionRequest::STATUS_APPROVED_GUARDIAN);
}
```

```python
# A03 - P09
def test_risk_contract_remains_stable_for_guarded_student(make_client):
    repo = one_student_repo(
        attendance=attendance_rows(1, present=10, unexcused=1),
        grades=grade_rows(1, [12, 11, 10, 14]),
    )
    body = make_client(repo).get("/v1/students/1/risk?period_id=3").json()

    assert body["student_id"] == 1
    assert body["model_version"] == "rules-1.0"
    assert body["insufficient_data"] is False
    assert body["risk_level"] in {"BAJO", "MEDIO", "ALTO"}
    assert 0 <= body["risk_score"] <= 100
    assert isinstance(body["factors"], list)
    assert body["profile_cluster"] is None
```

```js
// A05 - P12
it('mantiene la sesión válida y limpia el token cuando expira', () => {
  const future = '2099-01-01T00:00:00.000Z'
  const expired = '2000-01-01T00:00:00.000Z'

  setToken('token-vivo')
  writeSession({ user: mapApiUser(apiUser), expiresAt: future })
  expect(readSession()).not.toBeNull()

  setToken('token-vivo')
  writeSession({ user: mapApiUser(apiUser), expiresAt: expired })
  expect(readSession()).toBeNull()
  expect(getToken()).toBeNull()
})
```

**Comandos de prueba disponibles y estado de esta validación**

```bash
Backend ejecutado: `php artisan test tests/Feature/SeederEnvironmentTest.php tests/Feature/AcademicModuleTest.php`.

Analítica ejecutada: `satre-analytics/.venv/Scripts/python.exe -m pytest tests/test_api.py -vv`.

Frontend Vitest intentado: `npx vitest run src/api/auth.test.js --reporter=verbose`; bloqueado por `ECONNRESET` durante la resolución/descarga del paquete.

Cypress: no ejecutado en esta validación.
```

### 4.3. Resultados de la ejecución automatizada

| Suite | Resultado observado |
| --- | --- |
| --- | --- |
| Backend Laravel (SeederEnvironmentTest y AcademicModuleTest) | 15 aprobadas, 0 fallidas; 121 aserciones; 57.05 s. Evidencia: `docs/evidencias/pest.txt`. |
| Analítica FastAPI (`tests/test_api.py`) | 44 aprobadas, 0 fallidas; advertencias registradas por pytest. Evidencia: `docs/evidencias/pytest.txt`. |
| Frontend Vitest | No validada: npm devolvió `ECONNRESET` al acceder a `registry.npmjs.org`. El intento quedó registrado en `docs/evidencias/frontend-bloqueado.txt`; se eliminó el archivo de salida vacío para evitar confundirlo con una evidencia de ejecución. No contabilizar como aprobada ni fallida. |
| Cypress E2E | No ejecutada. No hay reporte ni captura de esta sesión. |
| Total de pruebas aprobadas en las dos suites ejecutadas | 59 aprobadas de 59 ejecutadas (100% en esas dos suites únicamente). No incluye pruebas manuales, frontend Vitest ni Cypress. |
| Tiempo de ejecución | Backend: 57.05 s. Analítica: consultar el resumen en su evidencia; no se agrega una cifra conjunta. |

El porcentaje de aprobación se calcula solo sobre las dos suites completadas: $59/59 \times 100 = 100\%$. No representa la cobertura total del proyecto.

Evidencia de la ejecución: los reportes reales disponibles se guardan en `docs/evidencias/pest.txt` y `docs/evidencias/pytest.txt`. El intento frontend se documenta en `docs/evidencias/frontend-bloqueado.txt`; no contiene un reporte de pruebas válido.

Análisis de los fallos, si los hubo: las dos suites completadas no reportaron pruebas fallidas. El frontend no llegó a iniciar Vitest debido al error de red `ECONNRESET`; por ello, no se interpreta como fallo de una prueba.

## 5. Comparación entre pruebas manuales y automatizadas

| Aspecto | Pruebas manuales | Pruebas automatizadas |
| --- | --- | --- |
| Funcionalidades verificadas | No se realizaron pruebas manuales en esta validación; los escenarios manuales están planificados en la matriz. | Se ejecutaron suites de integración backend y contrato analítico. Frontend y Cypress no fueron validados. |
| Resultados (coincidencias o diferencias) | No hay resultados manuales que comparar. | 59 pruebas aprobadas en las dos suites ejecutadas. |
| Defectos detectados | No evaluados mediante ejecución manual. | Las suites completadas no reportaron pruebas fallidas; esto no acredita ausencia general de defectos. |
| Ventajas observadas | No evaluadas en esta ejecución. | Salidas reproducibles y conteos registrados. |
| Limitaciones observadas | Pendiente ejecutar y documentar. | Frontend bloqueado por conectividad npm; E2E y análisis estático pendientes. |

Posibilidades de ampliar la automatización: ampliar cobertura de los endpoints `/api/permissions`, `/api/incidents`, `/api/alerts`, y completar pruebas E2E de roles y reportes en Cypress.

## 6. Análisis de calidad del código con SonarQube

### 6.1. Preparación y ejecución del análisis

| Paso | Detalle |
| --- | --- |
| Instalación o servidor utilizado | `sonar-project.properties` declara `sonar.host.url=http://localhost:9000` y el proyecto `SATRE`. No se obtuvo una ejecución validada del análisis; por tanto, no se afirma que SonarQube haya analizado el proyecto. |
| Proyecto configurado en SonarQube | `sonar.projectKey=uc-group4612142_satre` y `sonar.projectName=SATRE`, con `sonar.sources` a backend, frontend y analytics. |
| Archivo de configuración y comando de análisis | Archivo: `sonar-project.properties`; comando recomendado: `docker run -d --name sonarqube -p 9000:9000 sonarqube:community` y luego `sonar-scanner -Dproject.settings=sonar-project.properties`. |
| Cobertura configurada | Sí, con `sonar.php.coverage.reportPaths=satre-backend/coverage.xml`, `sonar.javascript.lcov.reportPaths=coar-alerta-frontend/coverage/lcov.info` y `sonar.python.coverage.reportPaths=satre-analytics/coverage.xml`. |
| Análisis finalizado correctamente | No verificado; completar tras ejecutar scanner contra un servidor disponible. |

Evidencia: pendiente; no se obtuvo captura ni reporte de un análisis SonarQube.

### 6.2. Métricas obtenidas

| Métrica | Resultado obtenido | Interpretación |
| --- | --- | --- |
| Quality Gate |  |  |
| Bugs |  |  |
| Vulnerabilities |  |  |
| Code Smells |  |  |
| Coverage |  |  |
| Duplicated Lines (%) |  |  |
| Maintainability Rating |  |  |
| Reliability Rating |  |  |
| Security Rating |  |  |

Registrar solo los valores que aparecen en el análisis real.

### 6.3. Interpretación de los resultados

| Pregunta | Respuesta sustentada en las métricas |
| --- | --- |
| ¿El Quality Gate fue aprobado o fallido? |  |
| ¿Qué problemas de calidad fueron identificados? |  |
| ¿Cuántos bugs, vulnerabilidades y code smells se reportaron? |  |
| ¿Qué porcentaje de cobertura se obtuvo, si está disponible? |  |
| ¿Qué partes del código requieren mayor atención? |  |
| ¿Qué problemas deberían corregirse primero y por qué? |  |
| ¿Qué relación hay entre los resultados de las pruebas y el análisis estático? |  |
| ¿Qué mejoras concretas se proponen? |  |

### 6.4. Lista priorizada de mejoras

| Prioridad | Mejora propuesta | Hallazgo que la justifica | Impacto esperado |
| --- | --- | --- | --- |
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |

## 7. Conclusiones

Síntesis del estado del software a partir de:

1. Las pruebas realizadas: las suites automatizadas de backend y analítica terminaron con 15 y 44 pruebas aprobadas, respectivamente. Esto confirma los comportamientos cubiertos por esas suites, no la ausencia general de defectos. La evidencia quedó guardada en `docs/evidencias/`.
2. Los defectos identificados: no se clasificaron defectos; la validación no incluyó ejecución manual completa ni análisis Sonar.
3. El nivel de automatización alcanzado: hay pruebas automatizadas existentes en las tres capas y se ejecutaron satisfactoriamente backend y analítica. Frontend Vitest y Cypress quedan pendientes de ejecución verificada.
4. Los resultados de SonarQube: no disponibles; el análisis está pendiente y no se reportan métricas.

## 8. Evidencias y anexos

Pendiente de completar por el estudiante: nombre del docente/asesor y fecha de entrega en la portada. No se generaron capturas de pantalla en esta sesión; obtenerlas al ejecutar los escenarios y adjuntarlas aquí.

### Anexo A. Índice de capturas de pantalla

| Figura | Descripción | Caso o sección relacionada |
| --- | --- | --- |
| — | No se capturaron imágenes durante esta validación. | Anexo pendiente; adjuntar capturas propias tras ejecutar casos manuales y SonarQube. |

### Anexo B. Código fuente completo de las pruebas automatizadas

Las pruebas completas se encuentran en `satre-backend/tests/Feature/AcademicModuleTest.php`, `satre-backend/tests/Feature/SeederEnvironmentTest.php`, `satre-analytics/tests/test_api.py` y `coar-alerta-frontend/src/api/auth.test.js`. Consultar las salidas efectivamente generadas en el Anexo C; la suite frontend no tiene resultado válido en esta sesión.

### Anexo C. Reportes de ejecución y de SonarQube

Reportes disponibles: `docs/evidencias/pest.txt` y `docs/evidencias/pytest.txt`. El bloqueo de npm está descrito en `docs/evidencias/frontend-bloqueado.txt`. No se generó reporte ni captura de SonarQube.
