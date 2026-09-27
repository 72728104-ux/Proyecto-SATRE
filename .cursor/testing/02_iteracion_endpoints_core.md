# Iteración 2: Pruebas de Endpoints de Analítica y Modelos

## Objetivo
Validar que los endpoints del motor analítico respondan datos reales utilizando `INTERNAL_KEY`.

## Tareas para Cursor
1. Revisa las rutas en `satre-analytics/app/api/` (ej. `/api/v1/analytics/predict` e `IA Docente`).
2. Verifica que cada endpoint lea correctamente las variables de configuración desde `app/config.py`.
3. Crea un script de prueba con `pytest` en `satre-analytics/tests/test_analytics_endpoints.py` que valide:
   - Envío de petición POST con header `X-Internal-Key` válido -> Esperado HTTP 200 OK.
   - Envío de petición POST sin header o con clave incorrecta -> Esperado HTTP 401 Unauthorized.
4. Ejecuta `pytest` en la terminal de `satre-analytics` y asegura 0 fallos.