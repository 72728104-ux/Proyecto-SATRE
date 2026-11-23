# Pendientes para cerrar el informe SATRE

Este listado distingue lo que quedó sin verificar de las pruebas ejecutadas. No se asignan resultados a secciones que no cuentan con evidencia observada.

1. **Frontend / Vitest:** repetir `npm ci` y ejecutar las pruebas cuando el acceso a npm esté disponible. La llamada de esta sesión terminó con `ECONNRESET` hacia `registry.npmjs.org`; el intento está documentado en `docs/evidencias/frontend-bloqueado.txt` y no representa un resultado de pruebas.
2. **Cypress E2E:** levantar los servicios requeridos y ejecutar una especificación E2E existente. No se registró ejecución ni captura.
3. **Pruebas manuales P01–P12:** ejecutar cada escenario manualmente y completar resultados, estado, incidencias y evidencias visuales en `docs/informe.md`. Los casos descritos son planificados; no deben presentarse como ejecución manual realizada.
4. **SonarQube:** el servidor local respondió el 10/11/2026 y las métricas se obtuvieron por API (`Quality Gate` Passed, 0 issues abiertos, cobertura 86,7 %, duplicación 1,1 %). La evidencia quedó en `docs/sonar/evidencias/`. Falta agregar las capturas del dashboard al Anexo C y repetir el scanner tras corregir `sonar-project.properties` (token en texto plano y claves duplicadas).
5. **Conversión del informe:** Pandoc no está instalado o no está disponible en PATH en esta sesión (`pandoc --version` no encontró el comando). Si se necesita PDF/Word, instalarlo por un canal aprobado y convertir después de cerrar el contenido.
6. **Datos académicos:** completar docente/asesor y fecha de entrega.
7. **Revisión de seguridad antes de compartir:** `sonar-project.properties` contiene un valor de token configurado. No exponerlo en documentos ni capturas; verificar si sigue activo, revocarlo/rotarlo si corresponde y usar una variable de entorno o un mecanismo local excluido del control de versiones.

## Evidencia actualmente disponible

- Backend Laravel: `docs/evidencias/pest.txt` — 15 aprobadas, 121 aserciones.
- Analítica Python: `docs/evidencias/pytest.txt` — 44 aprobadas, advertencias registradas.
- Reconocimiento del repositorio: `docs/evidencias/00-reconocimiento.md`.
