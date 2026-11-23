| ID del Bolt | Prompt Utilizado |
| --- | --- |
| INT-001-BOLT-001 | Actúa como Arquitecto de Software. Crea el monorepo con las carpetas satre-backend (Laravel), coar-alerta-frontend (React), satre-analytics (FastAPI), deploy y docs; añade .gitignore, .gitattributes y .dockerignore. |
| INT-001-BOLT-002 | Actúa como DevOps. Configura docker-compose.yml con los servicios nginx, php-fpm, worker, scheduler, python y mysql, redes internal/public, healthchecks y volúmenes persistentes. |
| INT-001-BOLT-003 | Actúa como DevOps. Escribe los Dockerfiles de PHP-FPM y nginx, php.ini, www.conf, entrypoints, SSL y cabeceras de seguridad. |
| INT-001-BOLT-004 | Actúa como SysAdmin. Configura Supervisor para queue y uvicorn, cron, logrotate y backup de MySQL; crea el usuario MySQL de solo lectura para analytics. |
| INT-001-BOLT-005 | Actúa como Ingeniero de Seguridad. Crea .env.example por capa, retira los secretos del repositorio y rota el token de Sonar. |
| INT-001-BOLT-006 | Actúa como Backend Laravel. Instala Laravel 12 y configura app, database, sanctum, cors, services y la zona horaria America/Lima. |
| INT-001-BOLT-007 | Actúa como Frontend. Configura Vite 8, React 19, Tailwind 4, oxlint, Vitest con jsdom y Cypress. |
| INT-001-BOLT-008 | Actúa como Backend Python. Configura FastAPI, SQLAlchemy, pydantic-settings, pytest y el Dockerfile de analytics. |
| INT-001-BOLT-009 | Actúa como DevOps. Crea el pipeline de GitHub Actions con jobs de backend, analytics y frontend. |
| INT-001-BOLT-010 | Actúa como DevSecOps. Endurece el CI fijando las actions por SHA y usando pip --only-binary y npm --ignore-scripts. |
| INT-001-BOLT-011 | Actúa como QA. Crea sonar-project.properties multi-lenguaje con fuentes, tests, exclusiones y rutas de reportes de cobertura. |
| INT-001-BOLT-012 | Actúa como DevOps. Levanta SonarQube local en Docker y documenta la instalación, el análisis y el Quality Gate. |
| INT-001-BOLT-013 | Actúa como Tech Writer. Redacta los documentos TO-BE, las reglas de Cursor, el informe técnico y el reconocimiento del repositorio. |
| INT-002-BOLT-001 | Actúa como Backend Laravel. Crea las migraciones base de users, cache y jobs. |
| INT-002-BOLT-002 | Crea la migración de personal_access_tokens para Sanctum con morphs y token único. |
| INT-002-BOLT-003 | Crea la migración de roles y amplía users con is_active, must_change_password y password_changed_at. |
| INT-002-BOLT-004 | Crea las migraciones de periodos, aulas, cursos, estudiantes, docentes, apoderados y matrículas con sus claves foráneas. |
| INT-002-BOLT-005 | Crea las migraciones de asistencias, notas, incidencias, presencias nocturnas y permisos. |
| INT-002-BOLT-006 | Crea las migraciones de risk_predictions, alerts, interventions, follow_ups y snapshots. |
| INT-002-BOLT-007 | Crea las migraciones de auditoría, documentos y catálogos auxiliares. |
| INT-002-BOLT-008 | Ajusta las tablas existentes al TO-BE: índices, claves foráneas y campos de control. |
| INT-002-BOLT-009 | Crea las migraciones de ai_diagnostics, tutor_sessions y tutor_messages. |
| INT-002-BOLT-010 | Crea las migraciones de metodologías y evaluación CREATE. |
| INT-002-BOLT-011 | Convierte las notas a escala MINEDU vigesimal con decimal(4,2) y migra los datos existentes. |
| INT-002-BOLT-012 | Añade DNI único en users, students y teachers con su índice. |
| INT-002-BOLT-013 | Actúa como Backend Laravel. Implementa los modelos Eloquent con relaciones, casts, scopes y constantes de dominio. |
| INT-002-BOLT-014 | Crea las factories de los modelos principales del dominio con estados realistas. |
| INT-002-BOLT-015 | Crea los seeders de roles, usuarios institucionales, caso académico P01, cinco roles y cohorte analítica. |
| INT-003-BOLT-001 | Actúa como Backend Laravel. Implementa User, Role e identidad institucional con login por correo o DNI. |
| INT-003-BOLT-002 | Implementa AuthService con login por correo o DNI, expiración de token y política de cambio de contraseña. |
| INT-003-BOLT-003 | Implementa AuthController con login, me, refresh, logout y change-password. |
| INT-003-BOLT-004 | Implementa el flujo de recuperación y restablecimiento de contraseña con throttling. |
| INT-003-BOLT-005 | Crea los middlewares EnsureUserHasRole, EnsurePasswordChanged, SecurityHeaders y EnsureCollegeHasResidence. |
| INT-003-BOLT-006 | Crea las policies por recurso para aislar rol, estudiante y apoderado. |
| INT-003-BOLT-007 | Implementa AuditLogger y el registro de eventos en audit_logs. |
| INT-003-BOLT-008 | Implementa el CRUD administrativo de usuarios con activación, baja lógica y reseteo de contraseña. |
| INT-003-BOLT-009 | Implementa la vinculación administrativa de apoderado con estudiante. |
| INT-003-BOLT-010 | Crea los resources y contratos JSON de usuario y autenticación. |
| INT-003-BOLT-011 | Actúa como Frontend. Crea api/auth.js con almacenamiento y expiración de sesión. |
| INT-003-BOLT-012 | Crea AuthContext, useIdleTimeout y las guardas ProtectedRoute y GuestRoute. |
| INT-003-BOLT-013 | Crea las pantallas Login, RecuperarContrasena, RestablecerContrasena y CambiarContrasena. |
| INT-003-BOLT-014 | Implementa la navegación por rol con Navbar, Sidebar y RoleSwitcher. |
| INT-003-BOLT-015 | Actúa como QA. Escribe pruebas de autenticación, tokens, contraseñas, CORS y matriz de roles. |
| INT-004-BOLT-001 | Actúa como Backend Laravel. Implementa los modelos y relaciones de periodo académico, aula, curso y matrícula. |
| INT-004-BOLT-002 | Implementa la escala MINEDU con conversión bidireccional entre 0-20 y AD, A, B, C. |
| INT-004-BOLT-003 | Implementa GradeService y GradeController para el registro y la actualización de notas. |
| INT-004-BOLT-004 | Crea GradeObserver, el evento GradeRecorded y la auditoría del cambio de nota. |
| INT-004-BOLT-005 | Implementa AttendanceService y AttendanceController para asistencia individual y por sesión. |
| INT-004-BOLT-006 | Añade validaciones de asistencia, roster por curso y guardado masivo. |
| INT-004-BOLT-007 | Implementa CourseController y el endpoint de sesión de asistencia por curso. |
| INT-004-BOLT-008 | Implementa ReportService para el rendimiento del estudiante y la analítica del aula. |
| INT-004-BOLT-009 | Crea los resources de Grade, Attendance y Course. |
| INT-004-BOLT-010 | Actúa como Frontend. Crea api/teacher.js para notas y asistencia. |
| INT-004-BOLT-011 | Crea la pantalla NotasIB con CriterionHint, ScoreBadge y mineduScale. |
| INT-004-BOLT-012 | Crea la pantalla AsistenciaAula con flujo de sesión y estados. |
| INT-004-BOLT-013 | Crea las vistas Calificaciones y AsistenciaEstudiante para autoconsulta. |
| INT-004-BOLT-014 | Actúa como QA. Escribe AcademicModuleTest, AcademicTest, AttendanceManagementTest, ClassroomAttendanceSessionTest y MineduScaleTest. |
| INT-005-BOLT-001 | Actúa como Backend Laravel. Implementa modelo, servicio y controlador de presencia nocturna con registro individual y masivo. |
| INT-005-BOLT-002 | Implementa ResidentController y el listado de residentes para administración y monitoría. |
| INT-005-BOLT-003 | Implementa modelo, servicio y controlador de incidencias con categoría, severidad y privacidad. |
| INT-005-BOLT-004 | Implementa modelo, servicio y controlador de permisos de salida con decisión del apoderado. |
| INT-005-BOLT-005 | Añade el toggle COLLEGE_HAS_RESIDENCE y el middleware que oculta residencia en colegios sin internado. |
| INT-005-BOLT-006 | Crea las policies de presencia, incidencia y permiso con aislamiento por rol. |
| INT-005-BOLT-007 | Crea los eventos AttendanceRecorded, IncidentRecorded y PermissionApproved. |
| INT-005-BOLT-008 | Actúa como Frontend. Crea api/residence.js y el dashboard del monitor. |
| INT-005-BOLT-009 | Crea las pantallas PresenciaNocturna, Incidencias, PermisosResidencia y AlertasResidencia. |
| INT-005-BOLT-010 | Crea la pantalla PermisosEstudiante para solicitud de salida. |
| INT-005-BOLT-011 | Crea las pantallas AutorizarPermisos e IncidenciasApoderado con vista resumida. |
| INT-005-BOLT-012 | Actúa como QA. Escribe ResidenceModuleTest y escenarios de privacidad y RBAC. |
| INT-006-BOLT-001 | Actúa como Backend Laravel. Crea los modelos RiskPrediction, RiskExplanation y StudentFeatureSnapshot. |
| INT-006-BOLT-002 | Crea los modelos Alert, Intervention y FollowUp con relaciones y estados. |
| INT-006-BOLT-003 | Implementa AlertService y AlertController para listado, actualización e intervenciones. |
| INT-006-BOLT-004 | Crea los eventos RiskEvaluated y AlertCreated con el listener CreateAlertsFromRisk. |
| INT-006-BOLT-005 | Crea los jobs EvaluateStudentRiskJob y RunRiskBatchJob para evaluación asíncrona. |
| INT-006-BOLT-006 | Implementa AnalyticsClient y PythonAnalyticsClient con timeout, reintentos y fallback. |
| INT-006-BOLT-007 | Implementa AnalyticsService con caché de 24 horas y persistencia de riesgo e insights. |
| INT-006-BOLT-008 | Define umbrales de riesgo, severidad de alertas y mapeo a recomendaciones. |
| INT-006-BOLT-009 | Configura rutas y autorización de alertas, intervenciones y seguimientos. |
| INT-006-BOLT-010 | Actúa como Frontend. Crea AlertWorkspace, AlertBadge, AlertasTutor y AlertasResidencia. |
| INT-006-BOLT-011 | Actúa como QA. Escribe AlertsModuleTest, AnalyticsBridgeTest y pruebas del contrato de riesgo. |
| INT-006-BOLT-012 | Añade resiliencia con insufficient_data y respuesta 200 ante caída de analytics. |
| INT-007-BOLT-001 | Actúa como Backend Python. Crea la app FastAPI con middleware X-Internal-Key, límite de body y manejo uniforme de errores. |
| INT-007-BOLT-002 | Configura settings, versión de modelo, conexión MySQL de solo lectura y variables de entorno. |
| INT-007-BOLT-003 | Implementa el repositorio SQLAlchemy con consultas text() parametrizadas y conexión READ ONLY. |
| INT-007-BOLT-004 | Construye las features de asistencia, notas, pernocta e incidencias. |
| INT-007-BOLT-005 | Implementa el motor determinista de riesgo con score, factores, nivel y recomendación. |
| INT-007-BOLT-006 | Implementa clustering KMeans y perfiles pedagógicos. |
| INT-007-BOLT-007 | Genera insights por aula, brechas por criterio y recomendación de metodologías. |
| INT-007-BOLT-008 | Expón los endpoints health, risk, batch risk y classroom insights. |
| INT-007-BOLT-009 | Añade fallback de base de datos con insufficient_data sin error 500 ni 503. |
| INT-007-BOLT-010 | Implementa PrivacyGuard para anonimizar PII y seudonimizar estudiantes. |
| INT-007-BOLT-011 | Implementa los servicios híbridos de IA para tutor y docente con cliente externo Gemini. |
| INT-007-BOLT-012 | Expón los endpoints socratic-tutor, teacher-assistant y teacher-report. |
| INT-007-BOLT-013 | Actúa como DevOps. Crea Dockerfile, uvicorn y supervisor en red interna sin exposición pública. |
| INT-007-BOLT-014 | Actúa como QA. Escribe la suite pytest de contrato, bordes, riesgo, clustering, privacidad, SQL safety e híbridos. |
| INT-008-BOLT-001 | Actúa como Backend Python. Implementa GeminiClient con reintentos, timeout, fallback y sanitización de respuestas. |
| INT-008-BOLT-002 | Implementa TeacherAssistantService y el endpoint del asistente pedagógico. |
| INT-008-BOLT-003 | Implementa SocraticTutorService con estado de sesión, fases y fallback de cortesía. |
| INT-008-BOLT-004 | Crea los modelos TutorSession y TutorMessage con resources y policies. |
| INT-008-BOLT-005 | Implementa modelos y servicios de lecturas, preguntas guiadas, quizzes y artefactos. |
| INT-008-BOLT-006 | Implementa la persistencia y caché de ai_diagnostics para insights docentes. |
| INT-008-BOLT-007 | Configura las rutas de tutor, asistente docente y eliminación de sesiones socráticas. |
| INT-008-BOLT-008 | Actúa como Frontend. Crea la pantalla IADocente con asistente conversacional y recomendaciones. |
| INT-008-BOLT-009 | Crea la pantalla IATutor con TutorBubble, TutorQuiz, HintActions y ArticleStudio. |
| INT-008-BOLT-010 | Implementa la sanitización de Mermaid, recursos visuales y protocolo CREATE. |
| INT-008-BOLT-011 | Actúa como QA. Escribe SocraticTutorTest, TeacherAssistantTest, GeminiClientTest y mide la cobertura. |
| INT-008-BOLT-012 | Añade guardrails de privacidad para no enviar PII a la IA externa. |
| INT-009-BOLT-001 | Actúa como Backend Laravel. Implementa el CRUD administrativo de usuarios con requests y resources. |
| INT-009-BOLT-002 | Implementa el CRUD administrativo de aulas, cursos y periodos académicos. |
| INT-009-BOLT-003 | Implementa el servicio de matrículas con importación masiva. |
| INT-009-BOLT-004 | Implementa el servicio de apoderados y su vinculación con estudiantes. |
| INT-009-BOLT-005 | Implementa el servicio y controlador de métricas administrativas. |
| INT-009-BOLT-006 | Implementa la consulta de auditoría con filtros y el resource de audit logs. |
| INT-009-BOLT-007 | Implementa ReportService y ReportController con exportación CSV y PDF. |
| INT-009-BOLT-008 | Configura las rutas apiResource administrativas y sus policies. |
| INT-009-BOLT-009 | Actúa como Frontend. Crea api/admin.js y el DashboardAdmin. |
| INT-009-BOLT-010 | Crea las pantallas Usuarios, Aulas, Cursos, Periodos y Auditoria. |
| INT-009-BOLT-011 | Crea la pantalla ReporteGrupo y el reporte pedagógico del docente. |
| INT-009-BOLT-012 | Actúa como QA. Escribe AdminTest, ReportsTest y AdminUserCoverageTest. |
| INT-010-BOLT-001 | Actúa como Frontend. Crea el design system base con Field, Modal, ConfirmModal, DataTable, Pagination, EmptyState, Skeleton, Toast, Tooltip, StatCard, AlertBadge, ScoreBadge, StatusRadioGroup y CoarLogo. |
| INT-010-BOLT-002 | Crea el shell de la aplicación con App.jsx, main.jsx, index.css, ErrorBoundary, NotFound y Forbidden. |
| INT-010-BOLT-003 | Implementa el enrutamiento por rol con AppRouter, ProtectedRoute, DashboardLayout, Sidebar y Navbar. |
| INT-010-BOLT-004 | Crea la landing institucional con hero, misión, visión, indicadores y acceso a login. |
| INT-010-BOLT-005 | Crea los dashboards de administrador, tutor, residencia, estudiante y apoderado. |
| INT-010-BOLT-006 | Implementa el cliente HTTP central con refresh de token, manejo de errores y descarga de archivos. |
| INT-010-BOLT-007 | Crea los hooks useApi, useIdleTimeout y useMediaQuery. |
| INT-010-BOLT-008 | Crea los módulos de datos de roles, institución y criterios IB. |
| INT-010-BOLT-009 | Ajusta el responsive, la accesibilidad y los estados de carga en todas las pantallas. |
| INT-010-BOLT-010 | Actúa como QA. Escribe la suite Vitest de componentes, páginas, hooks, API y utilidades. |
| INT-010-BOLT-011 | Escribe las especificaciones Cypress de navegación, apoderado, estudiante, residencia y tutor. |
| INT-010-BOLT-012 | Actúa como DevOps. Configura el build de producción, el lint con oxlint y la publicación estática vía nginx. |
| INT-010-BOLT-013 | Actúa como QA. Limpia los hallazgos Sonar de promesas, ternarios y expresiones regulares en el frontend. |
| INT-011-BOLT-001 | Actúa como QA. Configura phpunit.xml con SQLite en memoria y variables de entorno aisladas. |
| INT-011-BOLT-002 | Completa las suites backend Feature, Unit y Coverage hasta 248 métodos de prueba. |
| INT-011-BOLT-003 | Configura pytest.ini y conftest, y completa 215 pruebas de analytics. |
| INT-011-BOLT-004 | Configura Vitest con jsdom, coverage v8 y 289 pruebas de frontend. |
| INT-011-BOLT-005 | Configura Cypress y sus especificaciones E2E. |
| INT-011-BOLT-006 | Genera coverage.xml y lcov.info para Sonar. |
| INT-011-BOLT-007 | Actúa como DevOps. Instala SonarQube local y crea el proyecto SATRE con token. |
| INT-011-BOLT-008 | Ejecuta la primera línea base Sonar V1.0 y registra 27,064 líneas y 229 issues. |
| INT-011-BOLT-009 | Actúa como QA. Haz el triage y la priorización del backlog de 229 hallazgos. |
| INT-011-BOLT-010 | Remedia en backend los literales duplicados, parámetros sin uso y retornos excesivos. |
| INT-011-BOLT-011 | Remedia en frontend las promesas sin manejo, ternarios anidados y regex. |
| INT-011-BOLT-012 | Remedia en analytics los regex, la complejidad y el logging seguro. |
| INT-011-BOLT-013 | Reanaliza con Sonar y documenta 24 issues abiertos, 212 code smells, 16 vulnerabilidades y 1 bug. |
| INT-011-BOLT-014 | Cierra los issues S9383 y S1244 y verifica los regex corregidos. |
| INT-011-BOLT-015 | Actúa como QA. Consolida las evidencias de pruebas y calidad en docs/evidencias y el informe técnico. |
| INT-011-BOLT-016 | Documenta la cobertura de referencia: analytics 88.46% y frontend 99.55% en los archivos medidos. |
