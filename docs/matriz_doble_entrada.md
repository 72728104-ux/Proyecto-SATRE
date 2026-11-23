# Matriz de Ejecución AI-DLC — SATRE COAR Junín

**Proyecto:** SATRE — Sistema Web de Alerta Temprana para la Retención Estudiantil del COAR Junín
**Escenario:** Brown-Field (ingeniería inversa sobre un proyecto ya construido)
**Ventana de construcción documentada:** 15/09/2026 — 26/10/2026
**Modelo IA de referencia:** Claude Sonnet 4.5
**Responsable:** Meza Matias Miguel Angel
**Fuente de verdad:** código fuente, migraciones, suites de prueba, configuración CI/Sonar y reportes de calidad del repositorio.

## Matriz de doble entrada

| Intent | ID del Bolt | Descripción del Bolt | Modelo IA usado | Fecha | Dominio funcional | HU/Ticket | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-001 | Estructura del monorepo con backend Laravel, frontend React, analytics FastAPI, deploy y docs; .gitignore, .gitattributes y .dockerignore | Claude Sonnet 4.5 | 27/09/2026 | No aplica | INT-001-1 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-002 | Docker Compose con nginx, php-fpm, worker, scheduler, python y mysql; redes internal/public, healthchecks y volúmenes persistentes | Claude Sonnet 4.5 | 27/09/2026 | Infraestructura / DevOps | INT-001-2 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-003 | Dockerfiles de PHP y nginx; php.ini, www.conf, entrypoints, SSL y cabeceras de seguridad | Claude Sonnet 4.5 | 27/09/2026 | Infraestructura / DevOps | INT-001-3 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-004 | Supervisor para queue y uvicorn; cron, logrotate y backup MySQL; usuario MySQL de solo lectura para analytics | Claude Sonnet 4.5 | 27/09/2026 | Infraestructura / DevOps | INT-001-4 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-005 | .env.example por capa y retiro de secretos del repositorio; rotación del token de Sonar | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-001-5 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-006 | Bootstrap de Laravel 12 y configuración de app, database, sanctum, cors, services y zona America/Lima | Claude Sonnet 4.5 | 15/09/2026 | No aplica | INT-001-6 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-007 | Configuración del frontend con Vite 8, React 19, Tailwind 4, oxlint, Vitest con jsdom y Cypress | Claude Sonnet 4.5 | 27/09/2026 | No aplica | INT-001-7 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-008 | Configuración de analytics con FastAPI, SQLAlchemy, pydantic-settings, pytest y Dockerfile | Claude Sonnet 4.5 | 27/09/2026 | No aplica | INT-001-8 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-009 | Pipeline CI de GitHub Actions con jobs de backend, analytics y frontend | Claude Sonnet 4.5 | 27/09/2026 | Seguridad / QA | INT-001-9 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-010 | Endurecimiento del CI con acciones fijadas por SHA, pip --only-binary y npm --ignore-scripts | Claude Sonnet 4.5 | 19/10/2026 | Seguridad / QA | INT-001-10 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-011 | sonar-project.properties multi-lenguaje con fuentes, tests, exclusiones y reportes de cobertura | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-001-11 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-012 | SonarQube local en Docker y guía operativa de instalación, análisis y Quality Gate | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-001-12 | Meza Matias Miguel Angel |
| INT-001 Configuración de Infraestructura, Entorno y Testing | INT-001-BOLT-013 | Documentación TO-BE, reglas de Cursor, informe técnico y reconocimiento del repositorio | Claude Sonnet 4.5 | 27/09/2026 | No aplica | INT-001-13 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-001 | Migración base de users, cache y jobs de Laravel | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-1 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-002 | Migración de personal_access_tokens para Sanctum | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-2 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-003 | Migración de roles y extensión de users con is_active, must_change_password y password_changed_at | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-3 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-004 | Migración de estructura académica: periodos, aulas, cursos, estudiantes, docentes, apoderados y matrículas | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-4 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-005 | Migración de proceso operativo: asistencias, notas, incidencias, presencias nocturnas y permisos | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-5 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-006 | Migración de inteligencia y seguimiento: riesgo, alertas, intervenciones, follow-ups y snapshots | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-6 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-007 | Migración de tablas de soporte: auditoría, documentos y catálogos auxiliares | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-7 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-008 | Ajuste de tablas existentes para el TO-BE: índices, claves foráneas y campos de control | Claude Sonnet 4.5 | 02/10/2026 | Base de datos | INT-002-8 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-009 | Migración de ai_diagnostics, tutor_sessions y tutor_messages | Claude Sonnet 4.5 | 02/10/2026 | Base de datos | INT-002-9 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-010 | Migración de tablas de metodologías y evaluación CREATE | Claude Sonnet 4.5 | 02/10/2026 | Base de datos | INT-002-10 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-011 | Conversión de notas a escala MINEDU vigesimal con decimal(4,2) | Claude Sonnet 4.5 | 06/10/2026 | Base de datos | INT-002-11 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-012 | Adición de DNI único en users, students y teachers | Claude Sonnet 4.5 | 08/10/2026 | Base de datos | INT-002-12 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-013 | Modelos Eloquent con relaciones, casts, scopes y constantes de dominio | Claude Sonnet 4.5 | 15/09/2026 | Base de datos | INT-002-13 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-014 | Fábricas de datos para los modelos principales del dominio | Claude Sonnet 4.5 | 27/09/2026 | Base de datos | INT-002-14 | Meza Matias Miguel Angel |
| INT-002 Modelo de Datos y Migraciones | INT-002-BOLT-015 | Seeders de roles, usuarios institucionales, caso académico P01, cinco roles y cohorte analítica | Claude Sonnet 4.5 | 27/09/2026 | Base de datos | INT-002-15 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-001 | Modelo User, Role e identidad institucional para correo y DNI | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-1 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-002 | AuthService con login por correo o DNI, expiración de token y política de cambio de contraseña | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-2 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-003 | AuthController con login, me, refresh, logout y change-password | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-3 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-004 | Flujo de recuperación y restablecimiento de contraseña con throttling | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-4 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-005 | Middleware EnsureUserHasRole, EnsurePasswordChanged, SecurityHeaders y EnsureCollegeHasResidence | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-5 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-006 | Policies por recurso para aislamiento de rol, estudiante y apoderado | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-6 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-007 | AuditLogger y registro de eventos en audit_logs | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-7 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-008 | CRUD administrativo de usuarios con activación, baja lógica y reseteo de contraseña | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-003-8 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-009 | Vinculación administrativa de apoderado con estudiante | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-003-9 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-010 | Resources y contratos JSON de usuario y autenticación | Claude Sonnet 4.5 | 15/09/2026 | Autenticación | INT-003-10 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-011 | Cliente frontend api/auth.js con almacenamiento y expiración de sesión | Claude Sonnet 4.5 | 27/09/2026 | Autenticación | INT-003-11 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-012 | AuthContext, useIdleTimeout y guardas ProtectedRoute y GuestRoute | Claude Sonnet 4.5 | 27/09/2026 | Autenticación | INT-003-12 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-013 | Pantallas Login, RecuperarContrasena, RestablecerContrasena y CambiarContrasena | Claude Sonnet 4.5 | 27/09/2026 | Autenticación | INT-003-13 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-014 | Navegación por rol con Navbar, Sidebar y RoleSwitcher | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-003-14 | Meza Matias Miguel Angel |
| INT-003 Módulo de Usuarios y Autenticación | INT-003-BOLT-015 | Pruebas de autenticación, tokens, contraseñas, CORS y matriz de roles | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-003-15 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-001 | Modelos y relaciones de periodo académico, aula, curso y matrícula | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-1 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-002 | Soporte de escala MINEDU con conversión entre 0-20 y AD, A, B, C | Claude Sonnet 4.5 | 06/10/2026 | Gestión Académica | INT-004-2 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-003 | GradeService y GradeController para registro y actualización de notas | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-3 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-004 | GradeObserver, evento GradeRecorded y auditoría del cambio de nota | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-4 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-005 | AttendanceService y AttendanceController para asistencia individual y por sesión | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-5 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-006 | Validaciones de asistencia, roster por curso y guardado masivo | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-6 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-007 | CourseController y endpoint de sesión de asistencia por curso | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-7 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-008 | ReportService para rendimiento del estudiante y analítica del aula | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-8 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-009 | Resources de Grade, Attendance y Course | Claude Sonnet 4.5 | 15/09/2026 | Gestión Académica | INT-004-9 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-010 | Cliente frontend api/teacher.js para notas y asistencia | Claude Sonnet 4.5 | 27/09/2026 | Gestión Académica | INT-004-10 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-011 | Pantalla NotasIB con CriterionHint, ScoreBadge y mineduScale | Claude Sonnet 4.5 | 06/10/2026 | Gestión Académica | INT-004-11 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-012 | Pantalla AsistenciaAula con flujo de sesión y estados | Claude Sonnet 4.5 | 27/09/2026 | Gestión Académica | INT-004-12 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-013 | Vistas Calificaciones y AsistenciaEstudiante para autoconsulta | Claude Sonnet 4.5 | 27/09/2026 | Gestión Académica | INT-004-13 | Meza Matias Miguel Angel |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | INT-004-BOLT-014 | Pruebas AcademicModuleTest, AcademicTest, AttendanceManagementTest, ClassroomAttendanceSessionTest y MineduScaleTest | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-004-14 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-001 | Modelo, servicio y controlador de presencia nocturna con registro individual y masivo | Claude Sonnet 4.5 | 15/09/2026 | Residencia y Convivencia | INT-005-1 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-002 | ResidentController y listado de residentes para administración y monitoría | Claude Sonnet 4.5 | 15/09/2026 | Residencia y Convivencia | INT-005-2 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-003 | Modelo, servicio y controlador de incidencias con categoría, severidad y privacidad | Claude Sonnet 4.5 | 15/09/2026 | Residencia y Convivencia | INT-005-3 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-004 | Modelo, servicio y controlador de permisos de salida con decisión del apoderado | Claude Sonnet 4.5 | 15/09/2026 | Residencia y Convivencia | INT-005-4 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-005 | Toggle COLLEGE_HAS_RESIDENCE y middleware para ocultar residencia en colegios sin internado | Claude Sonnet 4.5 | 02/10/2026 | Residencia y Convivencia | INT-005-5 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-006 | Policies de presencia, incidencia y permiso con aislamiento por rol | Claude Sonnet 4.5 | 15/09/2026 | Seguridad / QA | INT-005-6 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-007 | Eventos AttendanceRecorded, IncidentRecorded y PermissionApproved | Claude Sonnet 4.5 | 15/09/2026 | Residencia y Convivencia | INT-005-7 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-008 | Cliente frontend api/residence.js y dashboard del monitor | Claude Sonnet 4.5 | 27/09/2026 | Residencia y Convivencia | INT-005-8 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-009 | Pantallas PresenciaNocturna, Incidencias, PermisosResidencia y AlertasResidencia | Claude Sonnet 4.5 | 27/09/2026 | Residencia y Convivencia | INT-005-9 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-010 | Pantalla PermisosEstudiante para solicitud de salida | Claude Sonnet 4.5 | 27/09/2026 | Residencia y Convivencia | INT-005-10 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-011 | Pantallas AutorizarPermisos e IncidenciasApoderado con vista resumida | Claude Sonnet 4.5 | 27/09/2026 | Residencia y Convivencia | INT-005-11 | Meza Matias Miguel Angel |
| INT-005 Residencia, Convivencia y Permisos | INT-005-BOLT-012 | Pruebas ResidenceModuleTest y escenarios de privacidad y RBAC | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-005-12 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-001 | Modelos RiskPrediction, RiskExplanation y StudentFeatureSnapshot | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-1 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-002 | Modelos Alert, Intervention y FollowUp con relaciones y estados | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-2 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-003 | AlertService y AlertController para listado, actualización e intervenciones | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-3 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-004 | Eventos RiskEvaluated y AlertCreated con listener CreateAlertsFromRisk | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-4 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-005 | Jobs EvaluateStudentRiskJob y RunRiskBatchJob para evaluación asíncrona | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-5 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-006 | AnalyticsClient y PythonAnalyticsClient con timeout, reintentos y fallback | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-6 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-007 | AnalyticsService con caché de 24 horas y persistencia de riesgo e insights | Claude Sonnet 4.5 | 02/10/2026 | Alertas y Riesgo | INT-006-7 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-008 | Umbrales de riesgo, severidad de alertas y mapeo a recomendaciones | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-8 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-009 | Rutas y autorización de alertas, intervenciones y seguimientos | Claude Sonnet 4.5 | 15/09/2026 | Alertas y Riesgo | INT-006-9 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-010 | Frontend AlertWorkspace, AlertBadge, AlertasTutor y AlertasResidencia | Claude Sonnet 4.5 | 27/09/2026 | Alertas y Riesgo | INT-006-10 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-011 | Pruebas AlertsModuleTest, AnalyticsBridgeTest y contrato de riesgo | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-006-11 | Meza Matias Miguel Angel |
| INT-006 Alertas, Riesgo e Intervenciones | INT-006-BOLT-012 | Resiliencia con insufficient_data y respuesta 200 ante caída de analytics | Claude Sonnet 4.5 | 02/10/2026 | Alertas y Riesgo | INT-006-12 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-001 | Aplicación FastAPI con middleware de X-Internal-Key, límite de body y manejo uniforme de errores | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-1 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-002 | Configuración de settings, versión de modelo, conexión MySQL de solo lectura y variables de entorno | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-2 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-003 | Repository SQLAlchemy con consultas text() parametrizadas y conexión READ ONLY | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-3 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-004 | Construcción de features de asistencia, notas, pernocta e incidencias | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-4 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-005 | Motor determinista de riesgo con score, factores, nivel y recomendación | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-5 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-006 | Clustering KMeans y perfiles pedagógicos | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-6 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-007 | Insights por aula, brechas por criterio y recomendación de metodologías | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-7 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-008 | Endpoints health, risk, batch risk y classroom insights | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-8 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-009 | Fallback de base de datos con insufficient_data sin error 500 ni 503 | Claude Sonnet 4.5 | 27/09/2026 | Analítica e IA | INT-007-9 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-010 | PrivacyGuard para anonimización de PII y seudonimización de estudiantes | Claude Sonnet 4.5 | 02/10/2026 | Analítica e IA | INT-007-10 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-011 | Servicios híbridos de IA para tutor y docente con cliente externo Gemini | Claude Sonnet 4.5 | 02/10/2026 | Analítica e IA | INT-007-11 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-012 | Endpoints socratic-tutor, teacher-assistant y teacher-report | Claude Sonnet 4.5 | 02/10/2026 | Analítica e IA | INT-007-12 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-013 | Dockerfile, uvicorn y supervisor en red interna sin exposición pública | Claude Sonnet 4.5 | 27/09/2026 | Infraestructura / DevOps | INT-007-13 | Meza Matias Miguel Angel |
| INT-007 Servicios Principales Core y Analítica | INT-007-BOLT-014 | Suite pytest de contrato, bordes, riesgo, clustering, privacidad, SQL safety e híbridos | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-007-14 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-001 | GeminiClient con reintentos, timeout, fallback y sanitización de respuestas | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-1 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-002 | TeacherAssistantService y endpoint de asistente pedagógico | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-2 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-003 | SocraticTutorService con estado de sesión, fases y fallback de cortesía | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-3 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-004 | Modelos TutorSession y TutorMessage con resources y policies | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-4 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-005 | Modelos y servicios de lecturas, preguntas guiadas, quizzes y artefactos | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-5 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-006 | Persistencia y caché de ai_diagnostics para insights docentes | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-6 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-007 | Rutas de tutor, asistente docente y eliminación de sesiones socráticas | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-7 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-008 | Pantalla IADocente con asistente conversacional y recomendaciones | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-8 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-009 | Pantalla IATutor con TutorBubble, TutorQuiz, HintActions y ArticleStudio | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-9 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-010 | Sanitización de Mermaid, recursos visuales y protocolo CREATE | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-10 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-011 | Pruebas SocraticTutorTest, TeacherAssistantTest, GeminiClientTest y cobertura | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-008-11 | Meza Matias Miguel Angel |
| INT-008 Módulo de IA Docente y Tutor Socrático | INT-008-BOLT-012 | Guardrails de privacidad para no enviar PII a la IA externa | Claude Sonnet 4.5 | 02/10/2026 | IA Educativa | INT-008-12 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-001 | CRUD administrativo de usuarios con requests y resources | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-1 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-002 | CRUD administrativo de aulas, cursos y periodos académicos | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-2 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-003 | Servicio de matrículas con importación masiva | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-3 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-004 | Servicio de apoderados y vinculación con estudiantes | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-4 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-005 | Servicio y controlador de métricas administrativas | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-5 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-006 | Consulta de auditoría con filtros y resource de audit logs | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-6 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-007 | ReportService y ReportController con exportación CSV y PDF | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-7 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-008 | Rutas apiResource administrativas y policies asociadas | Claude Sonnet 4.5 | 15/09/2026 | Administración | INT-009-8 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-009 | Cliente frontend api/admin.js y DashboardAdmin | Claude Sonnet 4.5 | 27/09/2026 | Administración | INT-009-9 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-010 | Pantallas Usuarios, Aulas, Cursos, Periodos y Auditoria | Claude Sonnet 4.5 | 27/09/2026 | Administración | INT-009-10 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-011 | Pantalla ReporteGrupo y reporte pedagógico del docente | Claude Sonnet 4.5 | 27/09/2026 | Administración | INT-009-11 | Meza Matias Miguel Angel |
| INT-009 Administración, Reportes y Auditoría | INT-009-BOLT-012 | Pruebas AdminTest, ReportsTest y AdminUserCoverageTest | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-009-12 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-001 | Design system base con Field, Modal, ConfirmModal, DataTable, Pagination, EmptyState, Skeleton, Toast, Tooltip, StatCard, AlertBadge, ScoreBadge, StatusRadioGroup y CoarLogo | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-1 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-002 | Shell de aplicación con App.jsx, main.jsx, index.css, ErrorBoundary, NotFound y Forbidden | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-2 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-003 | Enrutamiento por rol con AppRouter, ProtectedRoute, DashboardLayout, Sidebar y Navbar | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-3 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-004 | Landing institucional con hero, misión, visión, indicadores y acceso a login | Claude Sonnet 4.5 | 04/10/2026 | Experiencia de Usuario | INT-010-4 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-005 | Dashboards de administrador, tutor, residencia, estudiante y apoderado | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-5 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-006 | Cliente HTTP central con refresh de token, manejo de errores y descarga de archivos | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-6 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-007 | Hooks useApi, useIdleTimeout y useMediaQuery | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-7 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-008 | Módulos de datos de roles, institución y criterios IB | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-8 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-009 | Ajustes responsive, accesibilidad y estados de carga | Claude Sonnet 4.5 | 27/09/2026 | Experiencia de Usuario | INT-010-9 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-010 | Suite Vitest de componentes, páginas, hooks, API y utilidades | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-010-10 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-011 | Especificaciones Cypress de navegación, apoderado, estudiante, residencia y tutor | Claude Sonnet 4.5 | 27/09/2026 | Seguridad / QA | INT-010-11 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-012 | Build de producción, lint con oxlint y publicación estática vía nginx | Claude Sonnet 4.5 | 27/09/2026 | Infraestructura / DevOps | INT-010-12 | Meza Matias Miguel Angel |
| INT-010 Frontend y Experiencia de Usuario | INT-010-BOLT-013 | Limpieza Sonar de promesas, ternarios y expresiones regulares en frontend | Claude Sonnet 4.5 | 26/10/2026 | Seguridad / QA | INT-010-13 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-001 | phpunit.xml con SQLite en memoria y variables de entorno aisladas | Claude Sonnet 4.5 | 27/09/2026 | Seguridad / QA | INT-011-1 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-002 | Suites backend Feature, Unit y Coverage con 248 métodos de prueba | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-011-2 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-003 | pytest.ini, conftest y 215 pruebas de analytics | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-011-3 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-004 | Configuración Vitest con jsdom, coverage v8 y 289 pruebas frontend | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-011-4 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-005 | Configuración Cypress y especificaciones E2E | Claude Sonnet 4.5 | 27/09/2026 | Seguridad / QA | INT-011-5 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-006 | Generación de coverage.xml y lcov.info para Sonar | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-011-6 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-007 | Instalación de SonarQube local y creación del proyecto SATRE con token | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-011-7 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-008 | Primera línea base Sonar V1.0 con 27,064 líneas y 229 issues | Claude Sonnet 4.5 | 04/10/2026 | Seguridad / QA | INT-011-8 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-009 | Triage y priorización del backlog de 229 hallazgos | Claude Sonnet 4.5 | 19/10/2026 | Seguridad / QA | INT-011-9 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-010 | Remediación backend de literales duplicados, parámetros sin uso y retornos excesivos | Claude Sonnet 4.5 | 19/10/2026 | Seguridad / QA | INT-011-10 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-011 | Remediación frontend de promesas sin manejo, ternarios anidados y regex | Claude Sonnet 4.5 | 19/10/2026 | Seguridad / QA | INT-011-11 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-012 | Remediación analytics de regex, complejidad y logging seguro | Claude Sonnet 4.5 | 19/10/2026 | Seguridad / QA | INT-011-12 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-013 | Reanálisis Sonar con 24 issues abiertos, 212 code smells, 16 vulnerabilidades y 1 bug | Claude Sonnet 4.5 | 26/10/2026 | Seguridad / QA | INT-011-13 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-014 | Cierre de issues S9383 y S1244 y verificación de regex corregidos | Claude Sonnet 4.5 | 26/10/2026 | Seguridad / QA | INT-011-14 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-015 | Evidencias de pruebas y calidad en docs/evidencias e informe técnico | Claude Sonnet 4.5 | 23/10/2026 | Seguridad / QA | INT-011-15 | Meza Matias Miguel Angel |
| INT-011 Calidad, Seguridad y SonarQube | INT-011-BOLT-016 | Cobertura de referencia: analytics 88.46% y frontend 99.55% en los archivos medidos | Claude Sonnet 4.5 | 23/10/2026 | Seguridad / QA | INT-011-16 | Meza Matias Miguel Angel |

## Resumen por Intent

| Intent | Bolts | Tickets | Dominio principal | Ventana |
| --- | --- | --- | --- | --- |
| INT-001 Configuración de Infraestructura, Entorno y Testing | 13 | 13 | Infraestructura / DevOps | 15/09/2026 — 19/10/2026 |
| INT-002 Modelo de Datos y Migraciones | 15 | 15 | Base de datos | 15/09/2026 — 08/10/2026 |
| INT-003 Módulo de Usuarios y Autenticación | 15 | 15 | Autenticación | 15/09/2026 — 04/10/2026 |
| INT-004 Gestión Académica: Notas, Asistencia y Cursos | 14 | 14 | Gestión Académica | 15/09/2026 — 06/10/2026 |
| INT-005 Residencia, Convivencia y Permisos | 12 | 12 | Residencia y Convivencia | 15/09/2026 — 04/10/2026 |
| INT-006 Alertas, Riesgo e Intervenciones | 12 | 12 | Alertas y Riesgo | 15/09/2026 — 04/10/2026 |
| INT-007 Servicios Principales Core y Analítica | 14 | 14 | Analítica e IA | 27/09/2026 — 04/10/2026 |
| INT-008 Módulo de IA Docente y Tutor Socrático | 12 | 12 | IA Educativa | 02/10/2026 — 04/10/2026 |
| INT-009 Administración, Reportes y Auditoría | 12 | 12 | Administración | 15/09/2026 — 04/10/2026 |
| INT-010 Frontend y Experiencia de Usuario | 13 | 13 | Experiencia de Usuario | 27/09/2026 — 26/10/2026 |
| INT-011 Calidad, Seguridad y SonarQube | 16 | 16 | Seguridad / QA | 27/09/2026 — 26/10/2026 |
| **Total** | **148** | **148** | — | **15/09/2026 — 26/10/2026** |

## Trazabilidad de la extracción

- **Estructura y configuración:** `docker-compose.yml`, `deploy/`, `.github/workflows/ci.yml`, `sonar-project.properties`, `satre-backend/composer.json`, `coar-alerta-frontend/package.json`, `satre-analytics/requirements.txt` y `pytest.ini`.
- **Modelo de datos:** `satre-backend/database/migrations/` (15 migraciones), `database/factories/` y `database/seeders/`.
- **Backend:** `satre-backend/app/Http/Controllers`, `app/Services`, `app/Models`, `app/Policies`, `app/Jobs`, `app/Events`, `app/Listeners` y `routes/api.php`.
- **Analítica e IA:** `satre-analytics/app/main.py`, `app/risk.py`, `app/features.py`, `app/clustering.py`, `app/insights.py`, `app/services/ai/`, `app/services/privacy/` y `app/api/v1/`.
- **Frontend:** `coar-alerta-frontend/src/api`, `components`, `context`, `hooks`, `layouts`, `pages`, `routes` y `utils`.
- **Pruebas:** `satre-backend/tests`, `satre-analytics/tests` y `coar-alerta-frontend/src/**/*.test.*`; E2E en `coar-alerta-frontend/cypress/e2e`.
- **Calidad:** `docs/informe.md`, `docs/PENDIENTES.md`, `docs/evidencias/`, `docs/sonar/GUIA_SONARQUBE_SATRE.md`, `reporte_metricas.json`, `Cobertura.json`, `MejorasSonarqube.json` y `MejorasFinalesSonarQube.json`.
- **Cronología:** commits `fb8b6e2` (27/09/2026), `9fa2b9c` (04/10/2026), `d4757c4` (04/10/2026), `6f6cad1` (16/10/2026) y `9558853` (19/10/2026); fechas de migraciones 15/09, 02/10, 06/10 y 08/10; análisis Sonar del 04/10, 19/10 y 26/10.

## Convenciones

- Las fechas son reales cuando provienen de migraciones, commits o reportes; en los demás casos son estimadas a partir de la ventana de construcción y se expresan en formato DD/MM/AAAA.
- El modelo IA se asigna por defecto a **Claude Sonnet 4.5**; si en una fila se usó otro modelo, debe reemplazarse ese valor.
- Los tickets siguen el patrón `INT-XXX-N` y son acumulativos por Intent; un Bolt puede satisfacer más de un ticket, separado por coma.
- El responsable se toma del autor declarado en el informe técnico; ajustar si el equipo de mantenimiento cambia.
