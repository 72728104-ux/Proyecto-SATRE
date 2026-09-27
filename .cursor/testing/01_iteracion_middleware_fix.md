# Iteración 1: Exención de Middleware para Docs y CORS

## Objetivo
Permitir el acceso público a Swagger UI (`/docs`) y evitar bloqueos en peticiones `OPTIONS`.

## Tareas para Cursor
1. Revisa `satre-analytics/app/main.py` y el middleware de `X-Internal-Key`.
2. Exime explícitamente las rutas públicas de la validación del header:
   - `/docs`
   - `/openapi.json`
   - `/redoc`
3. Asegúrate de que `CORSMiddleware` permita:
   - Origins: `http://localhost:5173`, `http://127.0.0.1:5173`
   - Methods: `["*"]`
   - Headers: `["*"]`
4. Ejecuta o simula una petición `GET http://127.0.0.1:8001/docs` y confirma que devuelva estado 200 OK sin requerir `X-Internal-Key`.