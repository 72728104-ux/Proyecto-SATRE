# Iteración 4: Agente Conversacional Interactivo (IA Tutor / IA Docente)

## Objetivo
Evolucionar las respuestas estáticas a un flujo interactivo con soporte de Streaming.

## Tareas para Cursor
1. En `satre-analytics`:
   - Define el endpoint `POST /api/v1/ia-tutor/chat` que acepte un historial de mensajes.
   - Utiliza `StreamingResponse` para enviar fragmentos de texto en tiempo real.
2. En `coar-alerta-frontend`:
   - Modifica `IATutor.jsx` para reemplazar el formulario estático por un componente de Chat interactivo.
   - Implementa la lectura de stream HTTP para mostrar las respuestas del tutor carácter por carácter.