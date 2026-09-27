# SATRE · Frontend COAR Junín

Sistema Web de Alerta Temprana para la Gestión de Retención Estudiantil.
Frontend 100% independiente (React + Vite). Consume mock data local. Sin Laravel/PHP/DB.

## Comandos de inicialización (referencia)

Ya ejecutados en esta carpeta. Si partes de cero:

```bash
npm create vite@latest coar-alerta-frontend -- --template react
cd coar-alerta-frontend
npm install
npm install react-router-dom lucide-react
npm install -D tailwindcss @tailwindcss/vite cypress
```

Tailwind v4 se activa en `vite.config.js` (`@tailwindcss/vite`) y en `src/index.css` (`@import "tailwindcss"`).

## Scripts

```bash
npm run dev          # http://localhost:5173
npm run build
npm run preview
npx cypress open     # UI de Cypress
npx cypress run      # E2E headless (requiere `npm run dev`)
```

Cuentas demo (contraseña `coar2026`):

| Rol | Correo |
| --- | --- |
| Administrador | admin@coar.edu.pe |
| Docente / Tutor | tutor@coar.edu.pe |
| Monitor de residencia | residencia@coar.edu.pe |
| Estudiante | estudiante@coar.edu.pe |
| Apoderado | apoderado@coar.edu.pe |

En el header hay un selector **Probar rol** para cambiar de perfil sin volver al login.
