# SATRE COAR — Especificación Técnica TOBE-4 (SaaS Comercializable)

## 1. Visión General del Producto (TOBE-4)
Evolucionar el sistema SATRE de un prototipo experimental a una plataforma SaaS educativa de grado producción, adaptable a colegios públicos/privados (con y sin internado), alineada estrictamente con las normativas del Minedu Perú (evaluación cualitativa/cuantitativa) y con la arquitectura de IA Híbrida más avanzada en accesibilidad y usabilidad para estudiantes y docentes.

---

## 2. Requerimientos de Funcionalidad y Arquitectura

### A. Portal Público Landing Page (Previo al Login)
* **Ubicación:** Ruta `/` (El login migra a `/login`).
* **Componentes:**
  - Hero Section dinámico con imágenes institucionales del colegio.
  - Sección de Misión, Visión y Valores educativos.
  - Módulo de Noticias, Comunicados y Logros Académicos.
  - Indicadores clave (Estudiantes, Docentes, Metodología C.R.E.A.T.E.).
  - Botón flotante/destacado "Acceso a la Plataforma" (`/login`).
* **Limpieza:** Eliminar cualquier mención a "Demo", "Proyecto de Prueba" o logos genéricos.

### B. Sistema de Calificación Minedu (Escala Literal y Vigesimal)
* **Escala Oficial:**
  - `AD` (Logro Destacado): 18.00 – 20.00
  - `A` (Logro Esperado): 15.00 – 17.00
  - `B` (En Proceso): 11.00 – 14.00
  - `C` (En Inicio / Desaprobado): 0.00 – 10.00
* **Implementación Backend:**
  - Almacenar notas en valor numérico preciso (`decimal(4,2)`) en la base de datos.
  - Mutadores/Accesores en Laravel para convertir dinámicamente entre escala numérica (0-20) y escala literal Minedu (`AD`, `A`, `B`, `C`).
  - La IA de Analítica de Estudiantes en Riesgo (`satre-analytics`) debe evaluar competencias con la escala de 0 a 20 (Minedu) en reemplazo del sistema de 1 a 7.

### C. Identificación Institucional y Credenciales por DNI
* **Estructura de Correo:**
  - Estudiantes: `{DNI}@coar.edu.pe` (o dominio del colegio configurado).
  - Docentes: `d{DNI}@coar.edu.pe`
* **Base de Datos:**
  - Agregar campo único `dni` (`string`, 8 dígitos) en las tablas `users`, `estudiantes` y `docentes`.
  - Validación de login compatible tanto con correo institucional como con DNI directo.

### D. Escalabilidad SaaS: Módulo de Internado Configurable
* **Configuración Tenant/Colegio:**
  - Agregar variable en `.env` o tabla de configuración: `COLLEGE_HAS_RESIDENCE=true/false`.
* **Lógica en Frontend/Backend:**
  - Si es `false`: Ocultar y desactivar módulos de Residencia, Pernocta, Alergias en Comedor y Control de Salidas/Ingresos de internado.

### E. IA Híbrida Estudiantil (Superando Estándares del Mercado)
* **IA Tutor (Estudiantes - Gemini API):**
  - **Metodología C.R.E.A.T.E. Optimizada:** Conectar, Recordar, Explicar, Aplicar, Transferir, Evaluar.
  - **Publicación de Artículos Educativos:** Nuevo panel donde el estudiante puede redactar y publicar artículos asistido por la IA (co-escritura, revisión ortográfica, síntesis y citado automático).
  - **Reintentos y Fallback:** Implementar reintentos con exponencial backoff (`Http::retry(3, 1000)`) y alternancia a `gemini-1.5-flash` para garantizar disponibilidad continua.
  - **Diagramas Mermaid.js:** Sanitización estricta en el backend/frontend para evitar errores de sintaxis (escape de paréntesis y comillas).

---

## 3. Plan de Prompts de Ejecución para Cursor

Para aplicar esta versión de forma progresiva sin romper la lógica existente, ejecuta los siguientes prompts en el Composer de Cursor (`Ctrl + I`):

### PROMPT 1: Creación de la Landing Page Pública y Redirección
```text
Crea una vista Landing Page profesional para la ruta pública '/' en @coar-alerta-frontend.
1. La Landing debe incluir: Header con el logo del colegio, Sección Hero con banner dinámico, sección de información institucional (Historia, Misión, Noticias), y el botón "Iniciar Sesión" que redirige a '/login'.
2. Mueve la pantalla actual de inicio de sesión a la ruta '/login'.
3. Elimina del proyecto cualquier texto que haga referencia a "Demo", "Versión de Prueba" o "Fase Test".