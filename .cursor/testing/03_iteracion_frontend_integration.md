# Iteración 3: Sincronización de URLs y Puertos en Frontend

## Objetivo
Asegurar que el cliente de React llame al puerto correcto (8001 para FastAPI) y envíe las cabeceras requeridas.

## Tareas para Cursor
1. Revisa `coar-alerta-frontend/src/` para identificar llamadas HTTP al servicio analítico.
2. Actualiza los archivos de entorno `.env` y `.env.example`:
   - `VITE_ANALYTICS_API_URL=http://127.0.0.1:8001`
   - `VITE_INTERNAL_KEY=clave_secreta_super_segura_de_mas_de_32_caracteres_12345`
3. Revisa la vista `IADocente.jsx` y su servicio/hook de llamada:
   - Confirma que la URL base apunte a `VITE_ANALYTICS_API_URL`.
   - Confirma que el objeto de opciones pase `'X-Internal-Key': import.meta.env.VITE_INTERNAL_KEY`.
4. Corre `npm run lint` y `npm run build` en `coar-alerta-frontend` para verificar que no haya errores de compilación.