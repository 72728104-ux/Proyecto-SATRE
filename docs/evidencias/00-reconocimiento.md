# Reconocimiento del repositorio SATRE

## Alcance

Monorepositorio del Sistema Web de Alerta Temprana (SATRE) para el COAR Junín. La solución integra frontend React, backend Laravel, un servicio de analítica FastAPI y servicios de infraestructura definidos con Docker Compose.

## Componentes y herramientas identificados

- **Backend:** PHP 8.2.12 y Laravel 12; Composer 2.10.2. Pruebas Laravel/PHPUnit declaradas en `satre-backend/phpunit.xml`, con SQLite en memoria.
- **Analítica:** FastAPI y pytest. El entorno virtual del repositorio contiene pytest 9.1.1; el archivo `satre-analytics/tests/test_api.py` prueba contratos, autenticación interna, validación y fallbacks de la API.
- **Frontend:** React 19.2.8, Vite 8.2.2, Vitest 5.0.3 y Cypress 16.0.0, según `coar-alerta-frontend/package.json`. Vitest usa jsdom y encuentra pruebas `src/**/*.test.{js,jsx}` según `vite.config.js`.
- **Infraestructura:** Docker Compose define nginx, php-fpm, worker, scheduler, python y MySQL.
- **CI:** `.github/workflows/ci.yml` contiene trabajos diferenciados para backend, analítica y frontend.
- **Análisis estático:** existe `sonar-project.properties` en la raíz del repositorio.

## Entorno local observado

PHP 8.2.12, Composer 2.10.2, Node.js 26.7.0, npm 11.19.0, Python 3.13.15 y Docker 29.9.1. Durante una ejecución posterior, el entorno virtual de analítica informó Python 3.14.7 y pytest 9.1.1; indicar el intérprete exacto junto a cada ejecución cuando se reproduzcan los resultados.

## Comandos de pruebas identificados

- Backend: `php artisan test tests/Feature/SeederEnvironmentTest.php tests/Feature/AcademicModuleTest.php`
- Analítica: `satre-analytics/.venv/Scripts/python.exe -m pytest tests/test_api.py -vv`
- Frontend: `npm test -- --run src/api/auth.test.js` o `npx vitest run src/api/auth.test.js`; Cypress se ejecuta con el script `npm run cypress:run` y requiere un servidor frontend.

## Resultados de las ejecuciones documentadas

- Backend: 15 pruebas aprobadas y 121 aserciones; duración registrada de 57.05 s. Salida completa en `pest.txt`.
- Analítica: 44 pruebas aprobadas; la ejecución registró advertencias de dependencias. Salida completa en `pytest.txt`.
- Frontend: la ejecución no quedó validada. npm devolvió `ECONNRESET` al intentar acceder a `registry.npmjs.org`; se eliminó el archivo de salida vacío. El bloqueo está documentado en `frontend-bloqueado.txt` y no debe citarse como resultado de prueba.
- Cypress y SonarQube: no hay una ejecución validada en este paquete de evidencia.

## Precaución de publicación

Antes de compartir el repositorio o sus capturas, revisar `sonar-project.properties`: contiene un valor configurado como token de Sonar. No copiar ni publicar ese valor; revocarlo/rotarlo si es una credencial activa y mover secretos a variables de entorno.
