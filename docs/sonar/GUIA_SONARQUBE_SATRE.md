---
title: "GUÍA PRÁCTICA DE SONARQUBE"
subtitle: "Proyecto SATRE — Monorepo Laravel + React + FastAPI"
version: "1.0"
date: "Octubre 2026"
author: "Equipo SATRE — COAR Junín"
project: "SATRE — Sistema de Alerta Temprana para la Retención Estudiantil"
key: "uc-group4612142_satre"
---

## Ficha del documento

| Campo | Valor |
|---|---|
| Título | Guía práctica de SonarQube para el proyecto SATRE |
| Versión | 1.0 |
| Fecha | Octubre 2026 |
| Autor | Equipo SATRE — COAR Junín |
| Proyecto | SATRE — Sistema de Alerta Temprana para la Retención Estudiantil |
| Clave del proyecto Sonar | `uc-group4612142_satre` |
| Organización (SonarCloud) | `uc-group4612142` (UC-group) |
| Repositorio local | `C:\Proyecto` |
| Alcance | Monorepo completo: backend Laravel, frontend React, analytics FastAPI, infraestructura y CI |
| Servidor de referencia | SonarQube Community local (`http://localhost:9000`) o SonarCloud |
| Estado | Guía de instalación, análisis, línea base V1.0 y plan de mejora V2.0 |

> **Nota:** esta guía adapta la *Guía práctica de SonarQube* utilizada para la Academia Virtual V1 al monorepo SATRE. Conserva el enfoque práctico y lo complementa con la configuración real de las tres tecnologías del proyecto, la línea base obtenida y un plan de mejora verificable.

## Contenido

<!-- TOC -->

## 1. Objetivo y cómo usar esta guía

Esta guía tiene un objetivo concreto: que el equipo de SATRE pueda **instalar SonarQube, analizar el monorepo completo, interpretar los resultados y convertir los hallazgos en un plan de mejora verificable**. No se limita a mostrar comandos: explica por qué se hace cada paso y cómo demostrar el resultado con evidencias.

Al terminar, el equipo debe poder responder con datos:

- ¿Cuál es la calidad actual del código de SATRE?
- ¿Cuántas vulnerabilidades, bugs y code smells existen y dónde están?
- ¿Qué cobertura de pruebas se está importando realmente?
- ¿El Quality Gate se cumple o no, y por qué?
- ¿Qué se corrige primero en la V2.0 y cómo se comprueba la mejora?

### 1.1. Resultado esperado

Al finalizar la guía se dispondrá de:

1. Una instancia local de SonarQube funcionando con volúmenes persistentes.
2. Un proyecto `SATRE` con su token de análisis.
3. El archivo `sonar-project.properties` adaptado al monorepo.
4. Los reportes de cobertura de PHP, JavaScript y Python generados antes del scanner.
5. Un análisis completo con dashboard, issues, hotspots y Quality Gate.
6. Una línea base V1.0 documentada con capturas y métricas.
7. Un backlog priorizado y un conjunto de prompts para la V2.0.
8. Un pipeline de CI preparado para ejecutar el análisis de forma automática.

### 1.2. Convenciones

| Convención | Significado |
|---|---|
| `C:\Proyecto` | Raíz del monorepo SATRE en Windows |
| `PS>` | Terminal PowerShell |
| `<TOKEN>` | Token de SonarQube; nunca se escribe en el repositorio |
| `...` | Fragmento omitido para abreviar |
| **Negrita** | Concepto importante o nombre de una sección de SonarQube |
| `código` | Comando, archivo, propiedad o valor literal |

Los comandos están probados en Windows con PowerShell. En CMD cambian las continuaciones de línea (`^` en lugar de `` ` ``) y algunas variables de entorno. Cuando exista diferencia, se indica.

### 1.3. Tiempo estimado

| Actividad | Tiempo aproximado |
|---|---|
| Instalar Docker y SonarQube | 30–45 min |
| Crear proyecto y token | 10 min |
| Configurar el monorepo | 20 min |
| Generar cobertura (las tres suites) | 20–40 min |
| Ejecutar el análisis | 5–10 min |
| Revisar resultados y registrar evidencias | 60–90 min |
| **Total** | **3–4 horas** |

> **Importante:** la primera descarga de la imagen de SonarQube ronda 1,1 GB. La primera generación de cobertura del backend con Xdebug puede superar los 10 minutos; es normal. Para acortar tiempos, use PCOV o ejecute la cobertura en CI.

## 2. Contexto del proyecto SATRE

SATRE es el **Sistema de Alerta Temprana para la Retención Estudiantil** del COAR Junín. Es un monorepo con tres aplicaciones que colaboran y una carpeta de infraestructura:

| Componente | Carpeta | Tecnología | Responsabilidad |
|---|---|---|---|
| Backend transaccional | `satre-backend/` | Laravel 12, PHP 8.2, Sanctum, PHPUnit 11 | API REST, autenticación, reglas de negocio, persistencia |
| Frontend | `coar-alerta-frontend/` | React 19, Vite 8, React Router 7, Vitest 5 | Interfaces para estudiantes, tutores, apoderados, residencia y administración |
| Analytics | `satre-analytics/` | FastAPI, Python 3.12, pandas, scikit-learn, Gemini | Riesgo, clustering, insights, tutor socrático y reportes |
| Infraestructura | `deploy/` | Nginx, PHP-FPM, MySQL, scripts | Contenedores, configuración, respaldos y seguridad |
| CI | `.github/workflows/` | GitHub Actions | Pint, pruebas, lint y build |

### 2.1. Arquitectura lógica

```text
Navegador
   │ HTTPS
   ▼
Nginx (deploy/nginx)
   ├── /api  ──────────────► Laravel (satre-backend)
   │                             ├── MySQL
   │                             └── FastAPI (satre-analytics)
   │                                     └── Gemini / modelos
   └── /     ──────────────► React (coar-alerta-frontend, build estático)
```

### 2.2. Estructura del repositorio

```text
C:\Proyecto
├─ satre-backend/            API Laravel 12
│  ├─ app/                   Controllers, Services, Models, Policies...
│  ├─ database/              Migraciones y seeders
│  ├─ routes/                Rutas API
│  ├─ tests/                 PHPUnit (Unit + Feature)
│  └─ coverage.xml           Reporte Clover (se genera)
├─ coar-alerta-frontend/     React + Vite
│  ├─ src/                   Componentes, páginas, hooks, API
│  ├─ src/**/*.test.jsx      Pruebas colocadas junto al código
│  └─ coverage/lcov.info     Reporte LCOV (se genera)
├─ satre-analytics/          FastAPI + Python
│  ├─ app/                   Módulos de riesgo, IA y API
│  ├─ tests/                 pytest
│  └─ coverage.xml           Reporte Cobertura (se genera)
├─ deploy/                   Infraestructura y SonarQube local
├─ .github/workflows/        CI
├─ docker-compose.yml        Stack de la aplicación
├─ sonar-project.properties  Configuración del análisis
└─ scripts/sonar/            Automatización del análisis
```

### 2.3. Estrategia de análisis: un solo proyecto

Se analiza **todo el monorepo como un único proyecto Sonar** (`uc-group4612142_satre`). Así se obtiene una visión integrada de la calidad y una sola línea base para la V1.0.

| Alternativa | Ventaja | Desventaja |
|---|---|---|
| Un proyecto para todo el monorepo (recomendado) | Métricas y Quality Gate únicos; comparación entre versiones sencilla | Hay que cuidar las rutas de cobertura y las exclusiones |
| Un proyecto por componente | Aislamiento por equipo | Tres dashboards, tres tokens y una visión fragmentada; no refleja la calidad del sistema |

> **Decisión:** un proyecto, tres lenguajes. La clave `uc-group4612142_satre` se conserva para no perder la trazabilidad del análisis previo. Si se crea una instancia local nueva, se puede usar la misma clave sin problema.

### 2.4. Tamaño actual del código

| Indicador | Valor | Fuente |
|---|---|---|
| Líneas de código (ncloc) | 27.064 | Exportación de referencia de Sonar, octubre 2026 |
| Archivos PHP en `app/` | 193 | Conteo local |
| Archivos JS/JSX en `src/` | 110 | Conteo local |
| Archivos Python en `app/` | 29 | Conteo local |
| Archivos de prueba backend | 29 | Conteo local |
| Archivos de prueba frontend | 22 (111 tests) | Vitest, octubre 2026 |
| Archivos de prueba analytics | 14 | pytest |

Este tamaño justifica un análisis automatizado: revisar manualmente 27.000 líneas y 229 hallazgos no es viable ni repetible.

## 3. Requisitos previos

| Herramienta | Versión mínima | Verificado en este equipo | Comando de verificación |
|---|---|---|---|
| Docker Desktop | 4.x con motor Linux | Docker 29.9.1 (motor detenido al inicio) | `docker --version` |
| Java (para el scanner CLI) | 17 | OpenJDK 21 | `java -version` |
| PHP | 8.2 | 8.2.12 (XAMPP) | `php --version` |
| Xdebug o PCOV | Cualquiera reciente | Xdebug habilitado | `php -m` |
| Composer | 2.x | Instalado | `composer --version` |
| Node.js | 22 (CI) | 26.7.0 | `node --version` |
| npm | 10+ | 11.19.0 | `npm --version` |
| Python | 3.12 (CI) | 3.13.15 | `python --version` |
| pytest-cov | 5.x | Instalado en el entorno del proyecto | `python -m pytest --version` |
| Git | 2.x | Instalado | `git --version` |
| Navegador | Chrome, Edge o Firefox | — | Abrir `http://localhost:9000` |

### 3.1. Requisitos de hardware y red

- **Memoria:** 8 GB de RAM como mínimo; SonarQube y su motor de búsqueda consumen alrededor de 2 GB. Si el equipo tiene 8 GB, cierre aplicaciones pesadas antes del análisis.
- **Disco:** al menos 10 GB libres (imagen de ~1,1 GB + datos, índices y reportes).
- **CPU:** 2 núcleos; 4 recomendados.
- **Red:** conexión para descargar la imagen y las dependencias. No se requiere cuenta de Docker Hub para la imagen pública.

### 3.2. Verificación rápida antes de empezar

```powershell
docker --version
docker ps
java -version
php -m | Select-String -Pattern "xdebug|pcov"
node --version
python --version
```

Si `docker ps` falla con *"cannot connect to the Docker API"*, abra Docker Desktop y espere a que el motor esté en ejecución. Ese fue el estado inicial de este equipo: Docker estaba instalado, pero el daemon no estaba iniciado.

## 4. Instalar y verificar Docker Desktop

1. Descargue Docker Desktop desde el sitio oficial: `https://www.docker.com/products/docker-desktop/`.
2. Ejecute el instalador y acepte el uso de WSL 2 (recomendado en Windows 10/11).
3. Reinicie el equipo si el instalador lo solicita.
4. Abra Docker Desktop y espere a que el indicador inferior muestre **Engine running**.
5. Abra una terminal nueva y compruebe:

```powershell
docker --version
docker ps
docker run --rm hello-world
```

La salida de `hello-world` debe terminar con un mensaje similar a *"This message shows that your installation appears to be working correctly"*.

### 4.1. Problemas habituales

| Síntoma | Causa probable | Solución |
|---|---|---|
| `cannot connect to the Docker API` | Docker Desktop no está iniciado | Abrir Docker Desktop y esperar el motor |
| `WSL 2 installation is incomplete` | WSL no está actualizado | `wsl --update` y reiniciar |
| `Hardware assisted virtualization is not enabled` | Virtualización deshabilitada en BIOS/UEFI | Habilitar VT-x/AMD-V |
| Los contenedores Linux no arrancan | Docker está en modo Windows | Cambiar a *Linux containers* |
| Descarga muy lenta | Proxy o red corporativa | Configurar proxy en Docker Desktop |

> **Tip:** si no puede instalar Docker, puede usar SonarCloud (nube) para el análisis. La guía incluye las diferencias en la sección 19. La instalación local es la recomendada para la práctica porque permite ver el servidor, los volúmenes y las evidencias sin depender de Internet.

## 5. Instalar SonarQube local

### 5.1. Descargar la imagen

```powershell
docker pull sonarqube:community
docker images | Select-String sonarqube
```

Al cierre de esta guía (octubre de 2026), la etiqueta `community` apunta a la versión **26.10.0**. Para que el análisis sea reproducible, puede fijar la versión:

```powershell
docker pull sonarqube:26.10.0.133078-community
```

> **Nota:** SonarQube publica versiones mensuales. Use `sonarqube:community` para practicar y una versión fija para un entorno compartido. No use `lts-community` esperando la versión más reciente: esa etiqueta corresponde a la antigua línea 9.9.

### 5.2. Crear los volúmenes

Los volúmenes conservan los datos aunque el contenedor se detenga o se elimine:

```powershell
docker volume create sonarqube_data
docker volume create sonarqube_logs
docker volume create sonarqube_extensions
```

| Volumen | Contenido |
|---|---|
| `sonarqube_data` | Base de datos embebida, índices y datos del servidor |
| `sonarqube_logs` | Registros (`sonar.log`, `web.log`, `ce.log`, `es.log`) |
| `sonarqube_extensions` | Plugins y componentes descargados |

### 5.3. Iniciar el contenedor

En PowerShell:

```powershell
docker run -d `
  --name sonarqube `
  -p 127.0.0.1:9000:9000 `
  -v sonarqube_data:/opt/sonarqube/data `
  -v sonarqube_logs:/opt/sonarqube/logs `
  -v sonarqube_extensions:/opt/sonarqube/extensions `
  --restart unless-stopped `
  sonarqube:community
```

En CMD, en una sola línea:

```bat
docker run -d --name sonarqube -p 127.0.0.1:9000:9000 -v sonarqube_data:/opt/sonarqube/data -v sonarqube_logs:/opt/sonarqube/logs -v sonarqube_extensions:/opt/sonarqube/extensions --restart unless-stopped sonarqube:community
```

La publicación en `127.0.0.1` evita exponer la instancia a la red local. Si necesita acceder desde otro equipo, use un túnel o una configuración de red controlada; no publique SonarQube en Internet sin TLS, contraseñas fuertes y segmentación.

### 5.4. Opción reproducible con Docker Compose

El repositorio incluye `deploy/sonar/docker-compose.yml`. Es la forma recomendada para repetir la instalación:

```powershell
cd C:\Proyecto\deploy\sonar
docker compose up -d
docker compose logs -f sonarqube
```

Ventajas: la configuración queda versionada, se pueden limitar la memoria y los volúmenes, y se reinicia con un comando. Los volúmenes de Compose se llaman `satre-sonar_sonarqube_data`, etc.; no son los mismos que los del `docker run` anterior. Use una sola de las dos opciones para evitar confusión.

### 5.5. Verificar el arranque

```powershell
docker ps
docker logs -f sonarqube
```

Espere hasta ver un mensaje equivalente a *"SonarQube is operational"*. La primera vez puede tardar entre 2 y 5 minutos. También puede consultar el endpoint de salud:

```powershell
Invoke-RestMethod http://localhost:9000/api/system/health
```

Respuesta esperada:

```json
{
  "status": "GREEN",
  "causes": []
}
```

Si el estado es `YELLOW`, el servidor aún está iniciando. Si es `RED`, revise `docker logs sonarqube` y la sección 22.

### 5.6. Si el puerto 9000 está ocupado

Cambie el puerto del host:

```powershell
docker run -d --name sonarqube -p 127.0.0.1:9001:9000 ... sonarqube:community
```

Y use `http://localhost:9001` en el navegador y en `-Dsonar.host.url`.

## 6. Primer acceso y seguridad de la instancia

1. Abra `http://localhost:9000`.
2. Ingrese con las credenciales iniciales:
   - Usuario: `admin`
   - Contraseña: `admin`
3. SonarQube solicitará cambiar la contraseña. Use una contraseña larga y única, y guárdela en un gestor de contraseñas.
4. No reutilice la contraseña de otros servicios.

### 6.1. Usuarios y permisos

Para un equipo pequeño basta con el usuario `admin` para la práctica, pero un entorno compartido debe separar responsabilidades:

| Rol | Uso recomendado |
|---|---|
| Administrator | Configuración del servidor y de los Quality Gates |
| Project Administrator | Administración del proyecto SATRE |
| Browse | Lectura de resultados para docentes o revisores |
| Execute Analysis | Token de CI; no debe poder administrar el servidor |

> **Importante:** no use el token del usuario `admin` en GitHub Actions. Cree un usuario o un token específico para análisis y asígnele solo los permisos necesarios.

### 6.2. Configuración mínima recomendada

- Cambiar la contraseña de `admin`.
- Crear un usuario de servicio para CI (por ejemplo, `satre-ci`).
- Desactivar el acceso anónimo si la instancia no es pública: **Administration → Security → Force user authentication**.
- Configurar el correo SMTP solo si se van a enviar notificaciones; no es necesario para el análisis.
- Revisar la zona horaria y la URL base si se publica detrás de un proxy.

## 7. Crear el proyecto y generar el token

### 7.1. Crear el proyecto

1. En la barra superior, seleccione **Projects → Create project**.
2. Elija **Manually** (creación manual).
3. Complete:

| Campo | Valor |
|---|---|
| Project display name | `SATRE` |
| Project key | `uc-group4612142_satre` |
| Main branch | `main` (o `master`, según el repositorio) |
| Visibility | Private |

4. Seleccione **Create**.

> **Si el proyecto ya existe:** Sonar mostrará un error de clave duplicada. En ese caso, abra el proyecto existente y use **Project Information → Update Key** solo si es imprescindible; cambiar la clave rompe enlaces y evidencias anteriores. Para la práctica, conserve `uc-group4612142_satre`.

### 7.2. Definir la línea base y el "New Code"

Antes del primer análisis no hay historia. Después del primer análisis:

1. Abra **Project Information → New Code**.
2. Seleccione **Previous version**.
3. Registre la versión `1.0.0` en el primer análisis y `1.1.0` (o la que corresponda) en la V2.0.

Así, el Quality Gate se evalúa sobre lo que cambió, no sobre los 229 hallazgos heredados. Esto es clave para no bloquear al equipo por deuda histórica.

### 7.3. Generar el token

1. Vaya a **My Account → Security** (o al asistente de creación del proyecto).
2. Cree un token llamado `satre-v1-token`.
3. Seleccione el tipo **Project Analysis Token** si está disponible; si no, **User Token**.
4. Defina una caducidad (90 días o 1 año). Un token sin caducidad es una mala práctica.
5. Copie el token en el momento: SonarQube no lo vuelve a mostrar.

Ejemplo conceptual:

```text
sqp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 7.4. Guardar el token de forma segura

En la sesión de PowerShell:

```powershell
$env:SONAR_TOKEN = "sqp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

En GitHub Actions: **Settings → Secrets and variables → Actions → New repository secret**, nombre `SONAR_TOKEN`.

Nunca debe:

- Escribirse en `sonar-project.properties`.
- Guardarse en `README.md`, capturas o mensajes.
- Incluirse en un commit, incluso si luego se borra: el historial de Git conserva el secreto.
- Compartirse por correo o chat sin cifrado.

### 7.5. Verificar el token

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:9000/api/authentication/validate" `
  -Headers @{ Authorization = "Bearer $env:SONAR_TOKEN" }
```

Respuesta esperada:

```json
{
  "valid": true
}
```

Si recibe `401`, el token es incorrecto, expiró o pertenece a otro servidor.

## 8. Instalar y configurar SonarScanner

SonarQube recibe y visualiza el análisis; el código lo envía un **scanner**. Para este proyecto se puede usar el scanner CLI o la imagen Docker.

### 8.1. SonarScanner CLI en Windows

1. Descargue SonarScanner CLI desde la documentación oficial: `https://docs.sonarsource.com/sonarqube-server/latest/analyzing-source-code/scanners/sonarscanner/`.
2. Descomprima en `C:\sonar-scanner`.
3. Agregue `C:\sonar-scanner\bin` al `PATH`:
   - **Configuración → Sistema → Información → Configuración avanzada del sistema → Variables de entorno**.
   - En `Path`, seleccione **Nuevo** y agregue `C:\sonar-scanner\bin`.
   - Acepte y cierre todas las ventanas.
4. Cierre y abra una terminal nueva.
5. Verifique:

```powershell
sonar-scanner -h
sonar-scanner --version
```

El scanner CLI requiere Java 17 o superior. La distribución incluye un JRE; si usa una instalación sin JRE, instale Temurin 17/21.

### 8.2. Alternativa con Docker

Si no desea instalar el CLI:

```powershell
docker pull sonarsource/sonar-scanner-cli
```

Y ejecute el análisis con `-UseDocker` (sección 11) o con el comando de la sección 12.3.

### 8.3. Variables útiles

| Variable | Uso |
|---|---|
| `SONAR_TOKEN` | Token de análisis (obligatorio) |
| `SONAR_HOST_URL` | URL del servidor (`http://localhost:9000` o `https://sonarcloud.io`) |
| `SONAR_SCANNER_OPTS` | Opciones de la JVM, por ejemplo `-Xmx1g` si hay problemas de memoria |

```powershell
$env:SONAR_HOST_URL = "http://localhost:9000"
$env:SONAR_TOKEN = "sqp_..."
```

> **Nota:** en Docker, `localhost` dentro del contenedor no es el host. Use `http://host.docker.internal:9000` para un SonarQube local. El script `analyze.ps1` hace esta sustitución automáticamente.

## 9. Configurar el monorepo

### 9.1. Archivo `sonar-project.properties`

El archivo se ubica en la raíz `C:\Proyecto\sonar-project.properties`. Es el que ya está en el repositorio y contiene:

```properties
sonar.projectKey=uc-group4612142_satre
sonar.projectName=SATRE
sonar.projectVersion=1.0.0
sonar.sourceEncoding=UTF-8

sonar.sources=satre-backend/app,satre-backend/bootstrap/app.php,satre-backend/config,satre-backend/database,satre-backend/routes,satre-backend/resources/views,coar-alerta-frontend/src,satre-analytics/app,deploy,.github

sonar.tests=satre-backend/tests,satre-analytics/tests
sonar.test.inclusions=satre-backend/tests/**/*.php,satre-analytics/tests/**/*.py

sonar.exclusions=**/vendor/**,**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/.venv/**,**/venv/**,**/__pycache__/**,**/.pytest_cache/**,**/storage/**,**/bootstrap/cache/**,**/public/build/**,**/*.min.js,**/*.map,**/package-lock.json,**/composer.lock,**/*.sqlite,**/data/**,**/coverage.xml,**/.coverage,**/.scannerwork/**

sonar.php.coverage.reportPaths=satre-backend/coverage.xml
sonar.javascript.lcov.reportPaths=coar-alerta-frontend/coverage/lcov.info
sonar.python.coverage.reportPaths=satre-analytics/coverage.xml

sonar.coverage.exclusions=**/*.test.js,**/*.test.jsx,satre-backend/bootstrap/**,satre-backend/config/**,satre-backend/database/**,satre-backend/routes/**,coar-alerta-frontend/src/main.jsx
```

### 9.2. Explicación de cada propiedad

| Propiedad | Función | Por qué se usa este valor en SATRE |
|---|---|---|
| `sonar.projectKey` | Identificador único del proyecto | Conserva la clave del análisis previo |
| `sonar.projectName` | Nombre visible | `SATRE` |
| `sonar.projectVersion` | Versión analizada | Permite comparar V1.0 y V2.0 |
| `sonar.sourceEncoding` | Codificación | Los archivos tienen tildes y caracteres en español |
| `sonar.sources` | Código fuente | Incluye las tres aplicaciones y la infraestructura |
| `sonar.tests` | Pruebas | PHP y Python tienen carpetas separadas |
| `sonar.test.inclusions` | Patrones de test | Evita analizar archivos auxiliares como código de producción |
| `sonar.exclusions` | Excluir dependencias y generados | `vendor`, `node_modules`, `dist`, cachés, reportes |
| `sonar.php.coverage.reportPaths` | Cobertura PHP | Reporte Clover de PHPUnit |
| `sonar.javascript.lcov.reportPaths` | Cobertura JS | Reporte LCOV de Vitest |
| `sonar.python.coverage.reportPaths` | Cobertura Python | Reporte XML de pytest-cov |
| `sonar.coverage.exclusions` | No medir código no testeable | Arranque, configuración, migraciones y tests |

### 9.3. Por qué no se analiza `vendor/` ni `node_modules/`

Esos directorios contienen código de terceros, no código desarrollado por el equipo. Analizarlos:

- Infla el tamaño del proyecto.
- Genera miles de hallazgos que el equipo no puede corregir.
- Distorsiona la duplicación y la deuda técnica.

No es "hacer trampa": es delimitar el alcance. Lo que **sí** sería una mala práctica es excluir `app/Services`, `src/pages` o `app/services` para mejorar el indicador. Esas carpetas contienen la lógica que el equipo debe mantener.

### 9.4. Cobertura y archivos de test del frontend

Los tests de React están colocados junto al código (`src/**/*.test.jsx`). El scanner los analiza como fuente, pero se excluyen del cálculo de cobertura con `sonar.coverage.exclusions`. Así se evita que los propios tests "cubran" código de producción de forma artificial.

Si en el futuro se mueven a `src/__tests__/`, se puede agregar esa carpeta a `sonar.tests`; no es necesario para esta versión.

### 9.5. Verificar la configuración

```powershell
Get-Content .\sonar-project.properties
```

Compruebe que:

- Se ejecuta desde `C:\Proyecto` (no desde una subcarpeta).
- Las rutas usan `/`, no `\`.
- Los reportes de cobertura existen antes del scanner.
- No hay un token escrito en el archivo.

## 10. Cobertura de pruebas

SonarQube **no genera** la cobertura: solo la importa. Cada tecnología produce su reporte con una herramienta distinta y Sonar lo asocia a los archivos analizados.

| Stack | Herramienta | Reporte | Propiedad de Sonar |
|---|---|---|---|
| Laravel / PHP | PHPUnit + Xdebug o PCOV | `satre-backend/coverage.xml` (Clover) | `sonar.php.coverage.reportPaths` |
| React / JS | Vitest + V8 | `coar-alerta-frontend/coverage/lcov.info` | `sonar.javascript.lcov.reportPaths` |
| FastAPI / Python | pytest-cov | `satre-analytics/coverage.xml` (Cobertura) | `sonar.python.coverage.reportPaths` |

### 10.1. Backend Laravel (PHPUnit + Xdebug/PCOV)

Primero compruebe que PHP tiene un motor de cobertura:

```powershell
php -m | Select-String -Pattern "xdebug|pcov"
```

En este equipo Xdebug está habilitado en `C:\xampp\php\php.ini`:

```ini
zend_extension = php_xdebug.dll
xdebug.mode = coverage
```

Si no aparece, habilite Xdebug o PCOV y reinicie la terminal. Luego:

```powershell
cd C:\Proyecto\satre-backend
$env:XDEBUG_MODE = "coverage"
php artisan test --coverage-clover=coverage.xml
```

Al final debe existir:

```text
C:\Proyecto\satre-backend\coverage.xml
```

Verificación:

```powershell
Get-Item .\coverage.xml | Select-Object Name, Length, LastWriteTime
Select-String -Path .\coverage.xml -Pattern "<coverage" | Select-Object -First 1
```

> **Advertencia de tiempo:** con Xdebug, la suite completa de SATRE puede tardar más de 10 minutos. Esto es normal: Xdebug instrumenta cada línea. Para reducir el tiempo:
>
> - Use **PCOV** en CI (`coverage: pcov` en `setup-php`), que es mucho más rápido.
> - Genere la cobertura una vez por versión, no en cada ejecución local.
> - Mientras desarrolla, ejecute `php artisan test` sin cobertura y reserve la cobertura para el cierre de la versión.

Alternativa con PCOV (si está instalado):

```powershell
php -d pcov.enabled=1 artisan test --coverage-clover=coverage.xml
```

Si aparece *"No code coverage driver available"*, no hay motor de cobertura activo. Sonar puede analizar el código igual, pero la métrica de cobertura quedará en 0 o no disponible.

### 10.2. Frontend React (Vitest + V8)

El proyecto ya tiene `@vitest/coverage-v8`. En `coar-alerta-frontend/vite.config.js` el reporter debe incluir `lcov`:

```javascript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  all: true,
  // ...
}
```

Ejecute:

```powershell
cd C:\Proyecto\coar-alerta-frontend
npm run test -- --coverage
```

Resultado de la ejecución de referencia (octubre de 2026):

```text
Test Files  22 passed (22)
Tests       111 passed (111)
Statements  99.26% (271/273)
Branches    98.29% (231/235)
Functions   98.38% (61/62)
Lines       99.55% (226/227)
```

El reporte queda en:

```text
C:\Proyecto\coar-alerta-frontend\coverage\lcov.info
```

> **Cuidado con la interpretación:** ese 99,55 % corresponde solo a los archivos incluidos en `coverage.include` (`src/api/client.js`, `src/api/auth.js`, `src/api/query.js`, `src/context/AuthContext.jsx`, `src/routes/ProtectedRoute.jsx`). No es la cobertura de los 110 archivos del frontend. Para medir más código, amplíe `coverage.include` de forma gradual y agregue pruebas; no reduzca el alcance solo para obtener un número alto.

#### Ajuste de rutas del LCOV en un monorepo

Vitest escribe rutas como `SF:src\api\auth.js`, relativas a `coar-alerta-frontend`. Sonar espera rutas relativas a la raíz del proyecto (`C:\Proyecto`). Sin ajuste, la cobertura puede aparecer en 0 %. El script `analyze.ps1` prefija `coar-alerta-frontend/` y normaliza las barras. Si ejecuta el scanner manualmente, aplique este ajuste:

```powershell
$lcov = "C:\Proyecto\coar-alerta-frontend\coverage\lcov.info"
$lines = Get-Content $lcov
$fixed = foreach ($line in $lines) {
  if ($line -match '^SF:(.+)$') {
    $file = $Matches[1] -replace '\\', '/'
    if (-not $file.StartsWith('coar-alerta-frontend/')) {
      $file = "coar-alerta-frontend/$file"
    }
    "SF:$file"
  } else { $line }
}
Set-Content -Path $lcov -Value $fixed -Encoding utf8
```

### 10.3. Analytics (pytest-cov)

Active el entorno virtual o use su intérprete directamente:

```powershell
cd C:\Proyecto\satre-analytics
.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=xml:coverage.xml --cov-report=term-missing
```

Si el entorno se llama `venv`:

```powershell
.\venv\Scripts\python.exe -m pytest --cov=app --cov-report=xml:coverage.xml --cov-report=term-missing
```

El reporte queda en:

```text
C:\Proyecto\satre-analytics\coverage.xml
```

La ejecución de referencia (4 de octubre de 2026) obtuvo **88,46 % de cobertura de líneas** (1.342 de 1.517 líneas). Vuelva a generarlo antes del análisis para que refleje el código actual.

> **Nota:** `coverage.py` escribe rutas absolutas en `<source>`. El script las normaliza a `satre-analytics/app` para que Sonar las resuelva desde la raíz del monorepo. Si genera el reporte en otra máquina o en Docker, verifique que las rutas coincidan con el checkout del scanner.

### 10.4. Verificar los tres reportes

```powershell
Get-Item C:\Proyecto\satre-backend\coverage.xml
Get-Item C:\Proyecto\coar-alerta-frontend\coverage\lcov.info
Get-Item C:\Proyecto\satre-analytics\coverage.xml
```

Los tres deben existir y tener un tamaño distinto de cero **antes** de ejecutar el scanner. Si falta uno, Sonar no falla necesariamente: simplemente no muestra esa cobertura.

### 10.5. Qué excluir de la cobertura y qué no

| Se puede excluir | No se debe excluir |
|---|---|
| `bootstrap/`, `config/`, `routes/` (glue code) | `app/Services`, `app/Http/Controllers`, `app/Policies` |
| Migraciones y seeders | Componentes y hooks con lógica |
| `main.jsx` (arranque) | `app/services/ai`, `app/services/deterministic` |
| Archivos `*.test.*` | Código de negocio "difícil de testear" |

Si un módulo es difícil de cubrir, la solución es diseñar pruebas o refactorizar para inyectar dependencias, no ocultarlo del indicador.

## 11. Ejecución de pruebas y reportes con un script

Para no repetir seis comandos en cada análisis, el repositorio incluye:

```text
C:\Proyecto\scripts\sonar\analyze.ps1
```

### 11.1. Uso básico

```powershell
cd C:\Proyecto
$env:SONAR_TOKEN = "sqp_..."
.\scripts\sonar\analyze.ps1
```

El script:

1. Verifica que exista `sonar-project.properties`.
2. Ejecuta las pruebas del backend con cobertura (salvo `-SkipBackend`).
3. Ejecuta Vitest con cobertura y normaliza el LCOV.
4. Ejecuta pytest con cobertura y normaliza el XML.
5. Lanza SonarScanner desde la raíz.
6. Muestra la URL del dashboard.

### 11.2. Opciones

| Opción | Efecto |
|---|---|
| `-Token "sqp_..."` | Token explícito (si no, usa `$env:SONAR_TOKEN`) |
| `-HostUrl "http://localhost:9000"` | Servidor SonarQube |
| `-Version "1.0.0"` | Versión registrada en el análisis |
| `-SkipTests` | No ejecuta pruebas; usa reportes existentes |
| `-SkipBackend` | No regenera la cobertura del backend |
| `-UseDocker` | Ejecuta el scanner con la imagen Docker |
| `-WaitForQualityGate` | Falla si el Quality Gate no se cumple |

### 11.3. Ejemplos

Análisis completo:

```powershell
.\scripts\sonar\analyze.ps1 -Version "1.0.0"
```

Solo scanner, con reportes ya generados:

```powershell
.\scripts\sonar\analyze.ps1 -SkipTests
```

Sin backend (porque Xdebug tarda demasiado):

```powershell
.\scripts\sonar\analyze.ps1 -SkipBackend
```

Con Docker y espera del Quality Gate:

```powershell
.\scripts\sonar\analyze.ps1 -UseDocker -WaitForQualityGate
```

### 11.4. Tiempos observados

| Etapa | Tiempo aproximado |
|---|---|
| Backend con Xdebug | > 10 min (puede llegar a 20) |
| Frontend con Vitest | 1–2 min |
| Analytics con pytest | < 1 min |
| Scanner | 1–3 min |

Si el script se interrumpe durante el backend, no se genera `coverage.xml`; vuelva a ejecutarlo o use `-SkipBackend`.

## 12. Ejecutar el análisis

### 12.1. Con SonarScanner CLI

Desde la raíz del monorepo:

```powershell
cd C:\Proyecto
sonar-scanner `
  -Dsonar.host.url=http://localhost:9000 `
  -Dsonar.token=$env:SONAR_TOKEN `
  -Dsonar.projectVersion=1.0.0
```

En una sola línea (CMD o PowerShell):

```powershell
sonar-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.token=$env:SONAR_TOKEN -Dsonar.projectVersion=1.0.0
```

También puede usar las variables de entorno oficiales:

```powershell
$env:SONAR_HOST_URL = "http://localhost:9000"
$env:SONAR_TOKEN = "sqp_..."
sonar-scanner -Dsonar.projectVersion=1.0.0
```

### 12.2. Qué hace el scanner

1. Lee `sonar-project.properties`.
2. Detecta los lenguajes presentes.
3. Indexa los archivos fuente y de test.
4. Ejecuta las reglas de análisis.
5. Importa los reportes de cobertura.
6. Envía los resultados al servidor.
7. El servidor calcula el Quality Gate y actualiza el dashboard.

### 12.3. Con Docker

```powershell
cd C:\Proyecto
docker run --rm `
  -v "${PWD}:/usr/src" `
  -e SONAR_HOST_URL="http://host.docker.internal:9000" `
  -e SONAR_TOKEN="$env:SONAR_TOKEN" `
  sonarsource/sonar-scanner-cli `
  -Dsonar.projectVersion=1.0.0
```

Si usa SonarCloud:

```powershell
docker run --rm `
  -v "${PWD}:/usr/src" `
  -e SONAR_HOST_URL="https://sonarcloud.io" `
  -e SONAR_TOKEN="$env:SONAR_TOKEN" `
  sonarsource/sonar-scanner-cli `
  -Dsonar.organization=uc-group4612142 `
  -Dsonar.projectVersion=1.0.0
```

### 12.4. Salida esperada

El log debe contener líneas similares a:

```text
INFO: Scanner configuration file: ...\sonar-scanner\conf\sonar-scanner.properties
INFO: Project root configuration file: C:\Proyecto\sonar-project.properties
INFO: Indexing files...
INFO: Load project repositories
INFO: Importing coverage report(s)...
INFO: Analysis report generated
INFO: EXECUTION SUCCESS
INFO: Analysis total time: ...
INFO: https://localhost:9000/dashboard?id=uc-group4612142_satre
```

Si aparece `EXECUTION FAILURE`, revise la sección 22. Los errores más comunes son token inválido, URL incorrecta, ruta de cobertura inexistente o configuración duplicada.

### 12.5. Tiempo y caché

El scanner crea `.scannerwork/` en la raíz. Es una caché local; no debe subirse al repositorio (ya está en `sonar.exclusions`). El análisis de 27.000 líneas tarda entre 1 y 3 minutos en un equipo de desarrollo.

## 13. Revisar los resultados

### 13.1. Dashboard

Abra `http://localhost:9000/dashboard?id=uc-group4612142_satre`. El dashboard muestra:

- **Quality Gate:** Passed o Failed, con las condiciones incumplidas.
- **New Code:** métricas del código nuevo (si se configuró "Previous version").
- **Overall Code:** métricas de todo el proyecto.
- **Security, Reliability, Maintainability:** ratings y hallazgos.
- **Coverage y Duplications:** porcentajes.
- **Issues:** número total y desglose por tipo.

> **Captura sugerida:** dashboard completo con la fecha visible y el nombre del proyecto.

### 13.2. Measures

**Measures** permite profundizar por métrica y comparar versiones:

| Sección | Qué revisar |
|---|---|
| Size | ncloc, archivos, funciones, clases |
| Reliability | Bugs, reliability rating |
| Security | Vulnerabilities, hotspots, security rating |
| Maintainability | Code smells, deuda técnica, maintainability rating |
| Coverage | Líneas cubiertas, ramas, cobertura por archivo |
| Duplications | Líneas duplicadas, densidad, bloques |
| Complexity | Complejidad ciclomática y cognitiva |
| Issues | Nuevos, abiertos, confirmados, falsos positivos |

Use el filtro por componente para ver el aporte de `satre-backend`, `coar-alerta-frontend`, `satre-analytics`, `deploy` y `.github`.

### 13.3. Issues

**Issues** es el listado de problemas concretos. Filtre por:

- **Type:** Bug, Vulnerability, Code Smell.
- **Severity:** Blocker, Critical, Major, Minor, Info.
- **Software Quality:** Security, Reliability, Maintainability.
- **File / Directory / Language.**
- **Status:** Open, Confirmed, In Progress, Resolved, Closed, False Positive.

Para cada issue conviene revisar:

1. La regla (`php:S1192`, `javascript:S3358`, etc.).
2. El archivo y la línea.
3. El mensaje y el impacto.
4. El esfuerzo estimado.
5. Si es un falso positivo justificable.

> **No cierre issues en bloque sin revisarlos.** Un cierre masivo destruye la trazabilidad y puede ocultar un problema real. Si una regla no aplica al contexto, márquela como falso positivo con una justificación y, si es recurrente, ajuste el perfil de calidad del proyecto.

### 13.4. Security Hotspots

**Security Hotspots** no son vulnerabilidades confirmadas: son puntos que requieren revisión humana. SonarQube pide decidir si el código es **Safe**, **Fixed** o **Acknowledged**.

Ejemplos típicos en SATRE:

- Cookies de sesión sin `Secure`/`HttpOnly`.
- Contenedores que se ejecutan como `root`.
- Dependencias instaladas sin `--ignore-scripts` o sin lockfile.
- Logs con datos personales o entradas de usuario.
- Consultas SQL construidas dinámicamente.
- Configuración de CORS.
- Prompts de IA que reciben datos sensibles.

Cada revisión debe registrar: archivo, línea, decisión, justificación y evidencia. Un hotspot marcado como "Safe" sin justificación es peor que uno pendiente.

### 13.5. Activity

**Activity** muestra el historial de análisis. Úselo para:

- Confirmar que el análisis se ejecutó con la versión correcta.
- Comparar la evolución entre V1.0 y V2.0.
- Ver la fecha y el autor del análisis.
- Descargar el informe de cambios.

### 13.6. Consultas API para evidencias

Puede exportar métricas e issues para anexarlos a la documentación:

```powershell
$base = "http://localhost:9000"
$headers = @{ Authorization = "Bearer $env:SONAR_TOKEN" }

Invoke-RestMethod "$base/api/measures/component?component=uc-group4612142_satre&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,ncloc" -Headers $headers |
  ConvertTo-Json -Depth 10 |
  Out-File "C:\Proyecto\docs\sonar\evidencias\medidas-v1.json" -Encoding utf8

Invoke-RestMethod "$base/api/issues/search?componentKeys=uc-group4612142_satre&ps=500" -Headers $headers |
  ConvertTo-Json -Depth 10 |
  Out-File "C:\Proyecto\docs\sonar\evidencias\issues-v1.json" -Encoding utf8
```

> **Nota:** la API devuelve como máximo 500 issues por página. Para el conjunto completo, itere con `p` o use la exportación del proyecto. En esta guía se usó una exportación de 229 issues.

## 14. Interpretar las métricas

### 14.1. Ratings

SonarQube resume la calidad en ratings de **A (mejor) a E (peor)**:

| Rating | Security | Reliability | Maintainability |
|---|---|---|---|
| A | 0 vulnerabilidades | 0 bugs | Deuda ≤ 5 % |
| B | ≥ 1 vulnerabilidad menor | ≥ 1 bug menor | Deuda ≤ 10 % |
| C | ≥ 1 vulnerabilidad mayor | ≥ 1 bug mayor | Deuda ≤ 20 % |
| D | ≥ 1 vulnerabilidad crítica | ≥ 1 bug crítico | Deuda ≤ 50 % |
| E | ≥ 1 vulnerabilidad bloqueante | ≥ 1 bug bloqueante | Deuda > 50 % |

Los umbrales exactos pueden variar según la versión y el perfil. Lo importante es la tendencia: un rating no reemplaza la revisión de los issues.

### 14.2. Cobertura

La cobertura mide qué porcentaje del código ejecutable fue ejecutado por las pruebas. No mide si las pruebas son buenas. Un 90 % de cobertura con aserciones débiles puede ser peor que un 70 % con pruebas significativas.

Para SATRE:

- La cobertura de Python (88,46 %) es la más consolidada.
- La cobertura del frontend (99,55 %) es alta pero **parcial**: solo mide cinco archivos.
- La cobertura del backend debe generarse con Xdebug/PCOV; la suite es grande y lenta.
- La cobertura global de Sonar solo será comparable cuando los tres reportes se importen en el mismo análisis.

### 14.3. Duplicación

La densidad de líneas duplicadas mide el porcentaje de código repetido. En SATRE la referencia es **2,6 %**, por debajo del umbral típico del 3 % para código nuevo. No es un problema prioritario, pero conviene vigilar los seeders y los tests, donde se concentran literales repetidos.

### 14.4. Complejidad cognitiva

Mide cuánto esfuerzo mental requiere entender una función. Sonar suele alertar a partir de 15. Las funciones con complejidad alta son candidatas a refactorización y a pruebas más cuidadosas. En SATRE hay funciones con complejidad 17, 21 y 31; están en la lista de prioridades de la V2.0.

### 14.5. Deuda técnica

La deuda técnica estima el tiempo necesario para corregir los code smells. En la línea base es de **2.619 minutos (≈ 43 h 39 min)**. Es una estimación, no una promesa: sirve para priorizar, no para calcular una fecha exacta.

### 14.6. Lo que SonarQube no mide

- Si el producto resuelve el problema del usuario.
- Si las pruebas reflejan casos reales.
- La calidad del diseño pedagógico o de la experiencia de usuario.
- La seguridad de la infraestructura fuera del código (red, TLS, backups).
- La privacidad de los datos más allá de los patrones detectados.

Por eso el Quality Gate debe complementarse con pruebas funcionales, revisión de código, pruebas de seguridad y validación con usuarios.

## 15. Línea base V1.0 de SATRE

La siguiente línea base proviene de la exportación de referencia de Sonar (octubre de 2026) y de las ejecuciones locales de cobertura. **Si al repetir el análisis obtiene valores distintos, registre los valores reales de su instancia**: la línea base debe ser reproducible y estar fechada.

### 15.1. Métricas generales

| Métrica | Valor V1.0 | Lectura |
|---|---|---|
| Líneas de código (ncloc) | 27.064 | Tamaño medio; requiere automatización |
| Bugs | 1 | Un bug mayor en el frontend |
| Vulnerabilidades | 16 | 10 mayores y 6 menores |
| Code smells | 212 | Deuda principal |
| Issues totales | 229 | 212 + 16 + 1 |
| Deuda técnica | 2.619 min (≈ 43 h 39 min) | Estimación de Sonar |
| Duplicación | 2,6 % | Por debajo del 3 % |
| Cobertura global en Sonar | n/d | Faltan reportes importados |
| Security Rating | C | 16 vulnerabilidades, 10 mayores |
| Reliability Rating | C | 1 bug mayor |
| Maintainability Rating | n/d | Consultar en Measures |
| Quality Gate | n/d | Registrar tras el primer análisis local |

### 15.2. Distribución por tipo y severidad

| Tipo | Cantidad | Porcentaje |
|---|---|---|
| Code Smell | 212 | 92,6 % |
| Vulnerability | 16 | 7,0 % |
| Bug | 1 | 0,4 % |
| **Total** | **229** | **100 %** |

| Severidad | Cantidad | Porcentaje |
|---|---|---|
| Critical | 95 | 41,5 % |
| Major | 109 | 47,6 % |
| Minor | 21 | 9,2 % |
| Info | 4 | 1,7 % |

### 15.3. Distribución por componente

| Componente | Issues | Observación |
|---|---|---|
| `satre-backend` | 138 | Mayor volumen; muchos en tests y seeders |
| `coar-alerta-frontend` | 49 | Ternarios anidados y complejidad |
| `satre-analytics` | 31 | Regex, complejidad y logging |
| `deploy` | 7 | Dockerfiles y `php.ini` |
| `.github` | 4 | Seguridad del pipeline |
| **Total** | **229** | |

### 15.4. Reglas con más hallazgos

| Regla | Cantidad | Tipo | Qué significa |
|---|---|---|---|
| `php:S1192` | 81 | Code Smell | Literales duplicados; definir constantes |
| `javascript:S3358` | 26 | Code Smell | Ternarios anidados; extraer a variables |
| `php:S1172` | 20 | Code Smell | Parámetros no usados |
| `php:S1142` | 9 | Code Smell | Demasiados `return` en un método |
| `python:S8786` | 5 | Code Smell | Regex con backtracking superlineal |
| `php:S112` | 5 | Code Smell | Excepciones genéricas |
| `javascript:S3776` | 4 | Code Smell | Complejidad cognitiva alta |
| `javascript:S8786` | 4 | Code Smell | Regex ineficiente |
| `python:S3776` | 4 | Code Smell | Complejidad cognitiva alta |
| `python:S6019` | 4 | Code Smell | Cuantificador regex que nunca repite |
| `php:S3776` | 4 | Code Smell | Complejidad cognitiva alta |
| `php:S1135` | 4 | Code Smell | Comentarios `TODO` pendientes |

### 15.5. Archivos con más hallazgos

| Archivo | Issues | Acción sugerida |
|---|---|---|
| `satre-backend/database/seeders/AnalyticsCohortSeeder.php` | 14 | Extraer constantes y dividir el seeder |
| `satre-analytics/app/services/ai/create_protocol.py` | 13 | Refactorizar funciones y regex |
| `satre-backend/tests/Feature/AdminTest.php` | 10 | Constantes para rutas y datos |
| `satre-backend/tests/Feature/SocraticTutorTest.php` | 10 | Constantes y helpers de test |
| `satre-backend/tests/Feature/AcademicModuleTest.php` | 8 | Constantes y helpers |
| `satre-backend/tests/Feature/AuthTest.php` | 7 | Constantes de endpoints |
| `coar-alerta-frontend/src/pages/estudiante/IATutor.jsx` | 6 | Ternarios, promesas y complejidad |
| `satre-backend/tests/Feature/RoleEndpointMatrixTest.php` | 6 | Tabla de casos y constantes |

### 15.6. Vulnerabilidades de la línea base

| # | Regla | Archivo / zona | Severidad | Acción |
|---|---|---|---|---|
| 1 | `githubactions:S7637` | `.github/workflows/ci.yml` | Major | Fijar acciones por SHA completo |
| 2 | `githubactions:S8541` | `.github/workflows/ci.yml` | Major | Usar `--only-binary=:all:` en pip |
| 3 | `githubactions:S8544` | `.github/workflows/ci.yml` | Major | Fijar versiones / usar lockfile |
| 4 | `githubactions:S6505` | `.github/workflows/ci.yml` | Major | Usar `--ignore-scripts` en npm |
| 5 | `docker:S6505` | `deploy/nginx/Dockerfile` | Major | Usar `--ignore-scripts` |
| 6 | `docker:S8541` | `satre-analytics/Dockerfile` | Major | Usar `--only-binary=:all:` |
| 7 | `docker:S8544` | `satre-analytics/Dockerfile` | Major | Fijar versiones |
| 8 | `php:S2068` | `AnalyticsCohortSeeder.php` | Major | Revisar credencial hardcodeada |
| 9 | `php:S2068` | `InstitutionalUserSeeder.php` | Major | Revisar credencial hardcodeada |
| 10 | `text:S8564` | `satre-backend/package.json` | Major | Agregar lockfile |
| 11 | `docker:S6471` | `deploy/nginx/Dockerfile` | Minor | Ejecutar como usuario no root |
| 12 | `docker:S6471` | `deploy/php/Dockerfile` | Minor | Ejecutar como usuario no root |
| 13 | `php:S3330` | `deploy/php/php.ini` | Minor | `session.cookie_httponly = 1` |
| 14 | `php:S2092` | `deploy/php/php.ini` | Minor | `session.cookie_secure = 1` |
| 15 | `pythonsecurity:S5145` | `student_tutor.py` | Minor | Sanitizar entrada antes de loguear |
| 16 | `pythonsecurity:S5145` | `socratic_hybrid.py` | Minor | Sanitizar entrada antes de loguear |

### 15.7. Bug de la línea base

| Regla | Archivo | Línea | Mensaje | Acción |
|---|---|---|---|---|
| `javascript:S9383` | `coar-alerta-frontend/src/pages/estudiante/IATutor.jsx` | 225 | Promesa sin `await`, `.catch()` ni `void` | Manejar el rechazo o marcar `void` con justificación |

### 15.8. Cobertura local de referencia

| Componente | Cobertura | Alcance | Fecha |
|---|---|---|---|
| Analytics (Python) | 88,46 % líneas | `app/` (1.342/1.517 líneas) | 04/10/2026 |
| Frontend (React) | 99,55 % líneas | Solo 5 archivos incluidos en Vitest | 23/10/2026 |
| Backend (Laravel) | n/d | Suite completa; Xdebug > 10 min | — |

La cobertura global de Sonar no debe calcularse sumando estos porcentajes: cada uno tiene un denominador distinto. El valor correcto aparecerá cuando los tres reportes se importen en el mismo análisis.

### 15.9. Lectura ejecutiva

**Fortalezas:**

- Duplicación baja (2,6 %): el código no está excesivamente copiado.
- Cobertura de Python consolidada (88,46 %) y suite de frontend amplia (111 tests).
- El proyecto tiene pruebas automatizadas en las tres capas; no se parte de cero.

**Riesgos:**

- 16 vulnerabilidades, 10 de ellas mayores, concentradas en CI, Docker y configuración de sesión.
- 95 issues críticos y 2.619 minutos de deuda estimada.
- La cobertura del backend no se está importando; el indicador global queda incompleto.
- Hay un bug mayor por una promesa no manejada en el frontend.

**Prioridad:**

1. Cerrar las 10 vulnerabilidades mayores y el bug.
2. Importar la cobertura de las tres suites.
3. Reducir los code smells de mayor volumen (`php:S1192`, `javascript:S3358`).
4. Refactorizar las funciones con complejidad alta.
5. Configurar el Quality Gate sobre código nuevo y ejecutarlo en CI.

## 16. Registrar y priorizar los issues

### 16.1. Plantilla de registro

| Campo | Ejemplo |
|---|---|
| ID | SQ-001 |
| Regla | `php:S1192` |
| Archivo | `satre-backend/tests/Feature/AuthTest.php` |
| Línea | 18 |
| Tipo | Code Smell |
| Severidad | Critical |
| Calidad | Maintainability |
| Problema | Literal `/api/auth/login` repetido 9 veces |
| Impacto | Bajo en ejecución; alto en mantenibilidad |
| Acción | Extraer constante `LOGIN_ENDPOINT` |
| Esfuerzo | 20 min |
| Responsable | Equipo backend |
| Estado | Open |
| Evidencia | Captura + regla + commit |

### 16.2. Backlog priorizado

| ID | Regla / zona | Cantidad | Severidad | Acción | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|
| SQ-001 | Vulnerabilidades mayores en CI/Docker | 10 | Major | Fijar SHAs, locks, `--ignore-scripts`, `--only-binary` | 1–2 días | P0 |
| SQ-002 | `php:S2068` seeders | 2 | Major | Mover credenciales a variables de entorno | 2 h | P0 |
| SQ-003 | `php:S3330`, `php:S2092` | 2 | Minor | Cookies `HttpOnly` y `Secure` | 30 min | P0 |
| SQ-004 | `javascript:S9383` | 1 | Major | Manejar promesa en `IATutor.jsx` | 30 min | P0 |
| SQ-005 | `php:S1192` | 81 | Critical | Constantes en tests y seeders | 2–3 días | P1 |
| SQ-006 | `javascript:S3358` | 26 | Major | Extraer ternarios anidados | 1–2 días | P1 |
| SQ-007 | `php:S1172` | 20 | Major | Eliminar parámetros no usados | 1 día | P1 |
| SQ-008 | `php:S1142` | 9 | Major | Reducir retornos / extraer métodos | 1 día | P1 |
| SQ-009 | `php:S3776`, `javascript:S3776`, `python:S3776` | 12 | Critical | Refactorizar complejidad | 3–5 días | P2 |
| SQ-010 | `python:S8786`, `javascript:S8786`, `python:S6019` | 13 | Major | Simplificar regex | 1–2 días | P2 |
| SQ-011 | `php:S112` | 5 | Major | Excepciones específicas | 1 día | P2 |
| SQ-012 | `php:S1135` | 4 | Info | Resolver o eliminar `TODO` | 2 h | P3 |

### 16.3. Criterios de priorización

Priorice con tres preguntas:

1. **¿Es seguridad?** Una vulnerabilidad confirmada va antes que cualquier code smell.
2. **¿Puede afectar a un usuario real?** Un bug en producción o un dato personal expuesto pesa más que un estilo.
3. **¿Cuánto cuesta corregirlo?** Los quick wins (constantes, parámetros no usados, cookies) liberan capacidad para refactorizaciones mayores.

Una matriz simple:

| Impacto \ Esfuerzo | Bajo | Alto |
|---|---|---|
| Alto | Hacer primero | Planificar |
| Bajo | Quick win | Descartar o posponer |

## 17. Revisar Security Hotspots

Un **Security Hotspot** es una zona del código que podría ser vulnerable, pero que requiere contexto para decidir. No es lo mismo que una vulnerabilidad: Sonar ya confirmó que hay un patrón de riesgo, pero no puede saber si el contexto lo hace explotable.

### 17.1. Proceso de revisión

1. Abra **Security Hotspots** en el proyecto.
2. Filtre por **To review**.
3. Lea la regla y el código alrededor.
4. Determine si el riesgo es real en el contexto de SATRE.
5. Marque:
   - **Safe:** el patrón no es explotable en este contexto.
   - **Fixed:** se corrigió el código.
   - **Acknowledged:** se acepta el riesgo con una decisión consciente.
6. Registre la justificación y la evidencia.

### 17.2. Hotspots probables en SATRE

| Zona | Riesgo | Pregunta de revisión |
|---|---|---|
| Cookies de sesión | Robo de sesión | ¿Tienen `Secure`, `HttpOnly` y `SameSite`? |
| Dockerfiles | Escalada de privilegios | ¿El proceso corre como root? |
| CI | Supply chain | ¿Las acciones están fijadas por SHA? ¿Se usan lockfiles? |
| Logs | Fuga de datos | ¿Se registran correos, DNI, nombres o tokens? |
| SQL | Inyección | ¿Se usan consultas parametrizadas? |
| CORS | Origen no confiable | ¿Los orígenes permitidos son explícitos? |
| IA | Prompt injection / PII | ¿Se envían datos personales al modelo? |
| Archivos | Path traversal | ¿Se valida el nombre y el tipo de archivo? |

### 17.3. Plantilla de revisión

| Campo | Ejemplo |
|---|---|
| ID | HS-001 |
| Archivo | `deploy/php/php.ini` |
| Regla | `php:S2092` |
| Riesgo | Cookie de sesión sin `Secure` |
| Contexto | La aplicación se sirve por HTTPS en producción |
| Decisión | Fixed |
| Acción | `session.cookie_secure = 1` |
| Evidencia | Commit + captura del hotspot resuelto |

## 18. Configurar el Quality Gate

### 18.1. Qué es

El Quality Gate es un conjunto de condiciones que el proyecto debe cumplir para considerarse "apto". SonarQube lo evalúa después de cada análisis y muestra **Passed** o **Failed**.

### 18.2. Sonar way

El gate integrado **Sonar way** se enfoca en el código nuevo. En versiones recientes exige, entre otras condiciones:

| Condición | Umbral típico |
|---|---|
| Nuevos issues | 0 |
| Nuevos Security Hotspots revisados | 100 % |
| Cobertura del código nuevo | ≥ 80 % |
| Duplicación del código nuevo | ≤ 3 % |
| Nuevas vulnerabilidades | 0 |

Verifique las condiciones exactas en **Quality Gates → Sonar way**, porque SonarSource las actualiza con las versiones.

### 18.3. Gate recomendado para SATRE

Para la V1.0, use **Sonar way** sobre código nuevo. Para la V2.0, puede crear un gate específico:

| Condición | Umbral | Justificación |
|---|---|---|
| New issues | 0 | Evitar que la deuda crezca |
| New vulnerabilities | 0 | Seguridad primero |
| New Security Hotspots reviewed | 100 % | Revisión consciente |
| New coverage | ≥ 80 % | Proteger la lógica nueva |
| New duplicated lines | ≤ 3 % | Evitar copia/pega |
| New blocker/critical issues | 0 | No introducir riesgos altos |

> **Importante:** no aplique un gate sobre **todo** el código en la V1.0 si la deuda histórica es alta: el proyecto siempre fallará y el equipo perderá la señal. Use el gate sobre código nuevo y un objetivo gradual para el código heredado.

### 18.4. Asignar el gate

1. **Quality Gates → Create** (o edite uno existente).
2. Agregue las condiciones.
3. Guarde.
4. **Project Information → Quality Gate →** seleccione el gate.
5. Ejecute un nuevo análisis y verifique el resultado.

### 18.5. Quality Gate en CI

Agregue `-Dsonar.qualitygate.wait=true` al scanner para que el job espere el resultado y falle si no se cumple:

```powershell
sonar-scanner `
  -Dsonar.host.url=http://localhost:9000 `
  -Dsonar.token=$env:SONAR_TOKEN `
  -Dsonar.qualitygate.wait=true
```

Sin esta propiedad, el scanner termina antes de que Sonar calcule el gate y el pipeline podría pasar aunque el gate falle.

## 19. Integración continua con GitHub Actions

El repositorio ya tiene `.github/workflows/ci.yml` con tres jobs: `backend`, `analytics` y `frontend`. La integración de Sonar agrega un cuarto job que consume los reportes de cobertura.

### 19.1. Dos arquitecturas posibles

| Opción | Cuándo usarla | Consideraciones |
|---|---|---|
| **SonarCloud** | Repositorio en GitHub y runners hospedados | No requiere servidor propio; el proyecto debe ser público o tener plan pago; configuración mínima |
| **SonarQube auto-hospedado** | Institución con servidor propio | El runner debe poder alcanzar la URL; necesita TLS, backups y administración |

> **Realidad práctica:** un SonarQube en `localhost` no es accesible desde GitHub Actions. Si usa un servidor propio, publíquelo con HTTPS en una URL accesible o use un runner self-hosted dentro de la red. Para la práctica, SonarCloud es la opción más simple.

### 19.2. Secretos y variables

| Nombre | Tipo | Valor |
|---|---|---|
| `SONAR_TOKEN` | Secret | Token de análisis |
| `SONAR_HOST_URL` | Variable | `https://sonarcloud.io` o URL del servidor |
| `SONAR_ORGANIZATION` | Variable | `uc-group4612142` (solo SonarCloud) |

Nunca escriba el token en el YAML. GitHub lo enmascara en los logs, pero un `echo` accidental puede exponerlo.

### 19.3. Estrategia recomendada: artefactos de cobertura

En lugar de ejecutar las pruebas dos veces, cada job sube su reporte y el job de Sonar los descarga:

```yaml
backend:
  # ...
  steps:
    - uses: actions/checkout@v4
    - uses: shivammathur/setup-php@v2
      with:
        php-version: "8.2"
        coverage: pcov
    - run: composer install --prefer-dist --no-interaction --no-progress
    - run: vendor/bin/pint --test
    - name: Tests + Clover
      env:
        XDEBUG_MODE: coverage
      run: |
        cp .env.example .env
        php artisan key:generate --force
        php artisan test --coverage-clover=coverage.xml
    - uses: actions/upload-artifact@v4
      with:
        name: coverage-backend
        path: satre-backend/coverage.xml

analytics:
  # ...
  steps:
    - uses: actions/setup-python@v5
      with:
        python-version: "3.12"
    - run: pip install --only-binary=:all: -r requirements-dev.txt
    - run: pytest --cov=app --cov-report=xml:coverage.xml
    - uses: actions/upload-artifact@v4
      with:
        name: coverage-analytics
        path: satre-analytics/coverage.xml

frontend:
  # ...
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm ci --ignore-scripts
    - run: npm run test -- --coverage
    - uses: actions/upload-artifact@v4
      with:
        name: coverage-frontend
        path: coar-alerta-frontend/coverage/lcov.info
```

El job de Sonar:

```yaml
sonar:
  name: SonarQube / SonarCloud
  needs: [backend, analytics, frontend]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: actions/download-artifact@v4
      with:
        name: coverage-backend
        path: satre-backend
    - uses: actions/download-artifact@v4
      with:
        name: coverage-analytics
        path: satre-analytics
    - uses: actions/download-artifact@v4
      with:
        name: coverage-frontend
        path: coar-alerta-frontend/coverage
    - name: Normalizar rutas del LCOV
      run: |
        python - <<'PY'
        from pathlib import Path
        p = Path("coar-alerta-frontend/coverage/lcov.info")
        out = []
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("SF:"):
                path = line[3:].replace("\\", "/")
                if not path.startswith("coar-alerta-frontend/"):
                    path = "coar-alerta-frontend/" + path
                out.append("SF:" + path)
            else:
                out.append(line)
        p.write_text("\n".join(out) + "\n", encoding="utf-8")
        PY
    - name: Sonar scan
      uses: SonarSource/sonarqube-scan-action@v5
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}
      with:
        args: >
          -Dsonar.organization=${{ vars.SONAR_ORGANIZATION }}
          -Dsonar.projectVersion=1.0.${{ github.run_number }}
          -Dsonar.qualitygate.wait=true
```

El archivo completo está en `docs/sonar/ci-sonar-job.yml`.

### 19.4. Ajustes que debe hacer al CI actual

1. En `backend`, cambiar `coverage: none` por `coverage: pcov`.
2. Reemplazar `php artisan test` por `php artisan test --coverage-clover=coverage.xml`.
3. En `analytics`, instalar `requirements-dev.txt` y ejecutar `pytest --cov=app --cov-report=xml:coverage.xml`.
4. En `frontend`, agregar `npm run test -- --coverage` (el reporter `lcov` ya está configurado).
5. Agregar los pasos de `upload-artifact`.
6. Agregar el job `sonar`.
7. Configurar `SONAR_TOKEN` y `SONAR_HOST_URL`.

### 19.5. Buenas prácticas de CI

- **Fijar acciones por SHA completo**, no por etiqueta flotante. Es una de las vulnerabilidades detectadas (`githubactions:S7637`).
- Usar `--ignore-scripts` en `npm ci` y `--only-binary=:all:` en `pip install` cuando sea posible.
- No ejecutar el análisis de Sonar en cada push a cualquier rama: hágalo en `main`, `staging` y pull requests.
- Usar `fetch-depth: 0` para que Sonar pueda calcular la culpa y el código nuevo.
- Cachear dependencias para reducir tiempos.
- No poner el token en `sonar-project.properties`.
- Revisar el Quality Gate antes de fusionar un PR.

## 20. Evidencias y documentación

La nota técnica no se demuestra con una captura suelta: se demuestra con un paquete ordenado y reproducible.

### 20.1. Evidencias mínimas

| Evidencia | Nombre sugerido | Qué demuestra |
|---|---|---|
| Dashboard V1 | `SATRE_SQ_V1_01_dashboard.png` | Estado general y Quality Gate |
| Measures V1 | `SATRE_SQ_V1_02_measures.png` | Métricas detalladas |
| Issues V1 | `SATRE_SQ_V1_03_issues.png` | Hallazgos y filtros |
| Security Hotspots | `SATRE_SQ_V1_04_hotspots.png` | Revisión de seguridad |
| Coverage | `SATRE_SQ_V1_05_coverage.png` | Cobertura importada |
| Quality Gate | `SATRE_SQ_V1_06_quality_gate.png` | Condiciones y resultado |
| Activity | `SATRE_SQ_V1_07_activity.png` | Fecha y versión del análisis |
| Configuración | `sonar-project.properties` | Reproducibilidad |
| Reportes | `coverage.xml`, `lcov.info` | Cobertura generada |
| Log del scanner | `scanner-v1.log` | Ejecución exitosa |
| Exportaciones | `issues-v1.json`, `medidas-v1.json` | Datos verificables |

### 20.2. Convención de nombres

```text
SATRE_SQ_V1_<NN>_<descripcion>.<ext>
SATRE_SQ_V2_<NN>_<descripcion>.<ext>
```

Ejemplo:

```text
SATRE_SQ_V1_01_dashboard.png
SATRE_SQ_V1_02_measures.png
SATRE_SQ_V1_03_issues.png
```

### 20.3. Estructura del paquete de evidencias

```text
docs/sonar/evidencias/
├─ v1/
│  ├─ SATRE_SQ_V1_01_dashboard.png
│  ├─ SATRE_SQ_V1_02_measures.png
│  ├─ SATRE_SQ_V1_03_issues.png
│  ├─ SATRE_SQ_V1_04_hotspots.png
│  ├─ SATRE_SQ_V1_05_coverage.png
│  ├─ SATRE_SQ_V1_06_quality_gate.png
│  ├─ SATRE_SQ_V1_07_activity.png
│  ├─ issues-v1.json
│  ├─ medidas-v1.json
│  └─ scanner-v1.log
├─ configuracion/
│  ├─ sonar-project.properties
│  ├─ docker-compose.yml
│  └─ analyze.ps1
└─ reportes/
   ├─ coverage-backend.xml
   ├─ coverage-analytics.xml
   └─ lcov-frontend.info
```

### 20.4. Checklist de evidencias

- [ ] Instancia de SonarQube levantada y saludable.
- [ ] Proyecto `SATRE` creado con la clave correcta.
- [ ] Token generado y probado.
- [ ] `sonar-project.properties` versionado.
- [ ] Los tres reportes de cobertura existen.
- [ ] El scanner terminó con `EXECUTION SUCCESS`.
- [ ] Dashboard V1 capturado.
- [ ] Measures, Issues, Hotspots y Quality Gate capturados.
- [ ] Activity con fecha y versión.
- [ ] Exportaciones JSON guardadas.
- [ ] Backlog priorizado documentado.
- [ ] Plan V2.0 con objetivos y prompts.

> **Privacidad:** las capturas no deben mostrar correos, DNI, tokens, contraseñas ni datos de estudiantes. Difumine o recorte antes de adjuntarlas.

## 21. Plan de mejora para la V2.0

### 21.1. Objetivos

| Objetivo | Línea base | Meta V2.0 |
|---|---|---|
| Vulnerabilidades | 16 | 0 |
| Bugs | 1 | 0 |
| Issues críticos | 95 | ≤ 10 |
| Deuda técnica | 2.619 min | ≤ 1.300 min |
| Cobertura del código nuevo | n/d | ≥ 80 % |
| Duplicación del código nuevo | 2,6 % global | ≤ 3 % |
| Quality Gate | n/d | Passed en código nuevo |
| Cobertura importada en Sonar | Incompleta | Las tres suites |

### 21.2. Fases

| Fase | Duración | Actividades | Salida |
|---|---|---|---|
| 0. Quick wins | 1 semana | Cookies, lockfiles, SHAs, bug de promesa, constantes de tests | Menos vulnerabilidades y ruido |
| 1. Seguridad | 2 semanas | Docker no root, sanitización de logs, credenciales, dependencias | 0 vulnerabilidades mayores |
| 2. Mantenibilidad | 3 semanas | Complejidad, ternarios, parámetros, excepciones | Menos code smells críticos |
| 3. Cobertura | Continua | Pruebas del backend, ampliar `coverage.include`, casos límite | ≥ 80 % en código nuevo |
| 4. Verificación | 1 semana | Nuevo análisis, Quality Gate, evidencias V2 | Dashboard V2 y comparación |

### 21.3. Acciones por regla

| Regla | Acción concreta | Verificación |
|---|---|---|
| `php:S1192` | Extraer constantes de rutas, correos y fechas en tests y seeders | `php artisan test` + scanner |
| `javascript:S3358` | Reemplazar ternarios anidados por variables o funciones | `npm run test` + lint |
| `php:S1172` | Eliminar parámetros no usados o usarlos | Tests + revisión |
| `php:S1142` | Extraer métodos y usar retornos tempranos | Tests de comportamiento |
| `php:S3776` | Dividir funciones de más de 15 de complejidad | Tests + revisión |
| `python:S8786` | Simplificar regex y agregar pruebas de casos límite | `pytest` |
| `python:S6019` | Corregir cuantificadores `*?`/`+?` mal usados | `pytest` |
| `php:S112` | Usar excepciones específicas | Tests de error |
| `php:S1135` | Resolver o eliminar `TODO` | Revisión |
| `javascript:S9383` | `await`, `.catch()` o `void` justificado | `npm run test` |
| `php:S2068` | Mover credenciales a `.env`/secretos | Revisión de configuración |
| `php:S3330`, `php:S2092` | Cookies `HttpOnly` y `Secure` | Prueba de login + cabeceras |
| `docker:S6471` | Usuario no root en imágenes | `docker run` + `whoami` |
| `githubactions:S7637` | SHA completo en acciones | Revisión del YAML |
| `githubactions:S6505` | `npm ci --ignore-scripts` | CI |
| `githubactions:S8541`, `S8544` | `--only-binary`, lockfiles | CI |
| `pythonsecurity:S5145` | Sanitizar/estructurar logs | Pruebas de logging |

### 21.4. Prompts reutilizables

Use un prompt por familia de reglas y un pull request pequeño. No pida "corrige todo SonarQube": el resultado será difícil de revisar y probablemente romperá comportamiento.

**Prompt 1 — Constantes (`php:S1192`)**

```text
Actúa como ingeniero senior de Laravel y revisor de SonarQube.
Proyecto: SATRE, Laravel 12, PHP 8.2.
Regla: php:S1192 (literales duplicados).
Objetivo: eliminar la duplicación de literales en los archivos indicados,
extrayendo constantes con nombres descriptivos.
Restricciones:
- No cambies el comportamiento de las pruebas.
- No uses NOSONAR ni modifiques el perfil de calidad.
- Mantén el estilo de Laravel Pint.
- Un cambio por familia de literales; no mezcles refactors no relacionados.
Entrega:
1. Diff unificado.
2. Lista de archivos y constantes creadas.
3. Comandos de verificación.
4. Riesgos o casos límite.
Archivos: <pega aquí la lista de archivos y líneas>.
```

**Prompt 2 — Complejidad cognitiva (`php:S3776`, `javascript:S3776`, `python:S3776`)**

```text
Actúa como ingeniero senior y especialista en refactorización.
Proyecto: SATRE. Archivo: <ruta>. Función: <nombre>. Complejidad actual: <n>.
Objetivo: reducir la complejidad cognitiva a 15 o menos sin cambiar el
comportamiento observable.
Pasos:
1. Explica brevemente por qué la función es compleja.
2. Propón una refactorización con funciones pequeñas y nombres claros.
3. Mantén las validaciones, los códigos de error y los mensajes actuales.
4. Agrega o ajusta pruebas que cubran los caminos extraídos.
5. Ejecuta la suite correspondiente y muestra el resultado.
No uses suppress warnings ni cambies la API pública sin justificarlo.
```

**Prompt 3 — Ternarios anidados (`javascript:S3358`)**

```text
Actúa como ingeniero senior de React.
Regla: javascript:S3358 (ternarios anidados).
Objetivo: reemplazar los ternarios anidados por variables, funciones o
renderizado condicional legible, sin cambiar la UI ni la accesibilidad.
Restricciones:
- No introduzcas dependencias nuevas.
- Mantén el comportamiento de los tests existentes.
- Si el componente tiene complejidad alta, aplica solo este cambio.
Entrega: diff, explicación de la legibilidad y comandos de prueba.
```

**Prompt 4 — Seguridad de CI y Docker**

```text
Actúa como ingeniero DevSecOps.
Proyecto: SATRE. Reglas: githubactions:S7637, S6505, S8541, S8544;
docker:S6471, S6505, S8541, S8544.
Objetivo: eliminar las vulnerabilidades de supply chain y de configuración
de contenedores.
Acciones:
1. Fijar las acciones de GitHub por SHA completo y comentar la versión.
2. Usar npm ci --ignore-scripts y pip install --only-binary=:all: cuando
   sea compatible.
3. Asegurar lockfiles y versiones reproducibles.
4. Ejecutar los contenedores con usuario no root.
5. Verificar que el pipeline sigue funcionando.
No cambies la lógica de la aplicación. Entrega diff y justificación de cada
decisión.
```

**Prompt 5 — Cobertura y pruebas**

```text
Actúa como ingeniero de calidad.
Proyecto: SATRE. Componente: <backend|frontend|analytics>.
Objetivo: elevar la cobertura del código nuevo a >= 80 % sin pruebas vacías.
Contexto: <pega el reporte de cobertura y los archivos con menor cobertura>.
Entrega:
1. Lista priorizada de casos de prueba por comportamiento, no por línea.
2. Pruebas nuevas con aserciones significativas.
3. Casos límite y errores esperados.
4. Comandos para generar el reporte.
5. Explicación de qué queda fuera y por qué.
No excluyas código de negocio para subir el porcentaje.
```

**Prompt 6 — Log injection (`pythonsecurity:S5145`)**

```text
Actúa como ingeniero de seguridad en Python/FastAPI.
Regla: pythonsecurity:S5145 (log injection).
Archivos: satre-analytics/app/api/v1/student_tutor.py y
satre-analytics/app/services/ai/socratic_hybrid.py.
Objetivo: evitar que entradas de usuario contaminen los logs.
Acciones:
1. Identifica el dato no confiable.
2. Sanitiza o estructura el log (logging con parámetros, no f-strings).
3. No registres PII ni prompts completos.
4. Agrega una prueba que demuestre el comportamiento.
Entrega diff, prueba y explicación del riesgo.
```

### 21.5. Mapeo con ISO/IEC 25010

El material del curso menciona la ISO 25001; el modelo de calidad de producto que se usa habitualmente para este análisis es **ISO/IEC 25010**. La relación es:

| Característica ISO/IEC 25010 | Métricas de SonarQube | Evidencia en SATRE |
|---|---|---|
| Adecuación funcional | Cobertura + pruebas funcionales | Suites de backend, frontend y analytics |
| Eficiencia de desempeño | Complejidad, regex, hotspots de rendimiento | `S8786`, `S6019`, funciones complejas |
| Compatibilidad | No medible directamente | Pruebas de integración y CI |
| Usabilidad | Reglas de accesibilidad (`S6819`, `S9379`) | Componentes React |
| Fiabilidad | Bugs, reliability rating | Bug de promesa en `IATutor.jsx` |
| Seguridad | Vulnerabilidades, hotspots, security rating | 16 vulnerabilidades de la línea base |
| Mantenibilidad | Code smells, deuda, duplicación, complejidad | 212 code smells, 2,6 % duplicación |
| Portabilidad | Docker, CI, configuración | `deploy/`, `docker-compose.yml`, Actions |

> **Nota:** ISO/IEC 25001 se orienta a la gestión de la calidad; ISO/IEC 25010 define el modelo de calidad del producto. Citar ambas correctamente fortalece el informe.

### 21.6. Definición de terminado (V2.0)

- [ ] Las 16 vulnerabilidades están cerradas o justificadas.
- [ ] El bug de la promesa está corregido y probado.
- [ ] El Quality Gate pasa en código nuevo.
- [ ] La cobertura de las tres suites se importa en Sonar.
- [ ] La cobertura del código nuevo es ≥ 80 %.
- [ ] La duplicación del código nuevo es ≤ 3 %.
- [ ] No hay issues críticos nuevos.
- [ ] El pipeline ejecuta el análisis y bloquea si el gate falla.
- [ ] Las evidencias V2 están capturadas y fechadas.
- [ ] El informe compara V1 vs. V2 con datos.

## 22. Errores frecuentes y solución

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Ports are not available: expose port 9000` | Otro proceso usa el puerto | Use `-p 127.0.0.1:9001:9000` y cambie la URL |
| El contenedor `sonarqube` se detiene | Memoria insuficiente o error de arranque | `docker logs sonarqube`; aumente RAM; revise `vm.max_map_count` en Linux |
| `Web server is not up` | Sonar aún está iniciando | Espere 2–5 min; consulte `/api/system/health` |
| `sonar-scanner` no se reconoce | `bin` no está en PATH | Agregue `C:\sonar-scanner\bin`; abra una terminal nueva |
| `UnsupportedClassVersionError` | Java antiguo | Instale Java 17/21 |
| `401 Unauthorized` | Token inválido o expirado | Genere otro token y actualice `SONAR_TOKEN` |
| `Project not found` | Clave o URL incorrecta | Revise `sonar.projectKey` y `sonar.host.url` |
| `You are not authorized to run analysis` | Token sin permisos | Use un token de análisis del proyecto correcto |
| `File ... can't be indexed twice` | `sonar.sources` y `sonar.tests` se solapan | Separe las rutas; no incluya tests en sources |
| `No code coverage driver available` | Sin Xdebug/PCOV | Habilite un motor de cobertura |
| Cobertura en 0 % | Reporte inexistente, ruta mal escrita o generado después del scanner | Genere antes; revise `sonar.*.coverage.reportPaths` |
| Cobertura de frontend en 0 % | Rutas LCOV relativas al frontend | Prefije `coar-alerta-frontend/` y normalice barras |
| Cobertura de Python en 0 % | `<source>` absoluto no coincide | Normalice a `satre-analytics/app` |
| `Quality Gate failed` | Condiciones incumplidas | Revise el detalle; no lo ignore |
| `qualitygate.wait` agota el tiempo | El análisis sigue en la cola | Aumente el timeout o revise el Compute Engine |
| `Java heap space` | Poca memoria para el scanner | `$env:SONAR_SCANNER_OPTS="-Xmx1g"` |
| `Failed to query Elasticsearch` | Memoria o datos corruptos | Reinicie; revise logs; respalde antes de borrar |
| `The token you provided is invalid` | Token mal copiado | Genere uno nuevo y no incluya espacios |
| `Organization not found` (SonarCloud) | Falta `sonar.organization` | Agregue la organización correcta |
| `The base directory ... does not exist` | Se ejecutó desde una subcarpeta | Ejecute desde `C:\Proyecto` |
| Docker no alcanza `localhost:9000` | `localhost` dentro del contenedor | Use `host.docker.internal` |
| `npm ERR!` o tests fallidos | Falla real de pruebas | Corrija antes de analizar; Sonar no reemplaza las pruebas |
| `eslint`/`oxlint` falla | Estilo o regla de lint | Corrija el lint; no lo desactive |
| `429 Too Many Requests` (SonarCloud) | Límite de la API | Espere o use un token con cuota |

### 22.1. Diagnóstico rápido

```powershell
docker ps
docker logs --tail 100 sonarqube
Invoke-RestMethod http://localhost:9000/api/system/health
sonar-scanner --version
Get-Content .\sonar-project.properties
Get-Item .\satre-backend\coverage.xml, .\coar-alerta-frontend\coverage\lcov.info, .\satre-analytics\coverage.xml
```

Si el scanner falla, ejecute con `-X` para ver el detalle:

```powershell
sonar-scanner -X -Dsonar.host.url=http://localhost:9000 -Dsonar.token=$env:SONAR_TOKEN
```

> **Cuidado:** el modo debug puede mostrar información sensible. No adjunte el log completo sin revisarlo.

## 23. Operación y mantenimiento

### 23.1. Detener, iniciar y reiniciar

Con `docker run`:

```powershell
docker stop sonarqube
docker start sonarqube
docker restart sonarqube
```

Con Docker Compose:

```powershell
cd C:\Proyecto\deploy\sonar
docker compose stop
docker compose start
docker compose restart
```

Los volúmenes conservan los datos; no es necesario volver a descargar la imagen.

### 23.2. Respaldar

```powershell
docker run --rm `
  -v sonarqube_data:/data `
  -v "${PWD}:/backup" `
  alpine tar czf /backup/sonarqube_data.tar.gz -C /data .
```

Repita para `sonarqube_logs` y `sonarqube_extensions` si desea una copia completa. Guarde los respaldos fuera del equipo y verifique que se puedan restaurar.

### 23.3. Actualizar

1. Lea las notas de la versión.
2. Detenga el contenedor.
3. Respalle los volúmenes.
4. Descargue la nueva imagen.
5. Elimine el contenedor (no los volúmenes) y vuelva a crearlo con la misma configuración.

```powershell
docker pull sonarqube:community
docker stop sonarqube
docker rm sonarqube
docker run -d --name sonarqube -p 127.0.0.1:9000:9000 `
  -v sonarqube_data:/opt/sonarqube/data `
  -v sonarqube_logs:/opt/sonarqube/logs `
  -v sonarqube_extensions:/opt/sonarqube/extensions `
  sonarqube:community
```

No actualice en medio de una entrega: una migración de base de datos puede tardar y no siempre es reversible.

### 23.4. Eliminar

```powershell
docker stop sonarqube
docker rm sonarqube
docker volume rm sonarqube_data sonarqube_logs sonarqube_extensions
```

Con Compose:

```powershell
docker compose down -v
```

> **Advertencia:** eliminar los volúmenes borra el historial, los proyectos, los tokens y las evidencias almacenadas en Sonar. Hágalo solo después de exportar todo lo necesario.

### 23.5. Seguridad operativa

- Mantenga SonarQube en `127.0.0.1` o detrás de un proxy con TLS.
- Use contraseñas fuertes y tokens con caducidad.
- Rote el token de CI si se sospecha una exposición.
- No comparta la instancia con datos reales de estudiantes sin anonimizar.
- Revise los permisos de los usuarios.
- Programe respaldos antes de cada versión.

## 24. Anexos

### 24.1. Comandos útiles

| Objetivo | Comando |
|---|---|
| Ver versión de Docker | `docker --version` |
| Ver contenedores | `docker ps` |
| Ver logs | `docker logs -f sonarqube` |
| Salud de Sonar | `Invoke-RestMethod http://localhost:9000/api/system/health` |
| Levantar con Compose | `docker compose up -d` |
| Ver versión del scanner | `sonar-scanner --version` |
| Cobertura backend | `php artisan test --coverage-clover=coverage.xml` |
| Cobertura frontend | `npm run test -- --coverage` |
| Cobertura analytics | `python -m pytest --cov=app --cov-report=xml:coverage.xml` |
| Análisis | `sonar-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.token=$env:SONAR_TOKEN` |
| Script completo | `.\scripts\sonar\analyze.ps1` |
| Validar token | `Invoke-RestMethod http://localhost:9000/api/authentication/validate -Headers @{Authorization="Bearer $env:SONAR_TOKEN"}` |
| Detener | `docker stop sonarqube` |
| Reiniciar | `docker start sonarqube` |
| Eliminar contenedor | `docker rm sonarqube` |

### 24.2. Checklist final

- [ ] Docker Desktop iniciado y funcionando.
- [ ] SonarQube responde `GREEN`.
- [ ] Contraseña de `admin` cambiada.
- [ ] Proyecto `SATRE` creado.
- [ ] Token generado, probado y guardado de forma segura.
- [ ] SonarScanner instalado o Docker disponible.
- [ ] `sonar-project.properties` en la raíz.
- [ ] Cobertura de backend generada.
- [ ] Cobertura de frontend generada y rutas normalizadas.
- [ ] Cobertura de analytics generada.
- [ ] Análisis ejecutado con `EXECUTION SUCCESS`.
- [ ] Dashboard, Measures, Issues y Hotspots revisados.
- [ ] Quality Gate registrado.
- [ ] Evidencias V1 capturadas.
- [ ] Backlog priorizado.
- [ ] Plan V2.0 con prompts y metas.
- [ ] CI preparado para ejecutar Sonar.

### 24.3. Glosario

| Término | Definición |
|---|---|
| **Análisis estático** | Revisión del código sin ejecutarlo |
| **Bug** | Defecto que puede producir un comportamiento incorrecto |
| **Code Smell** | Problema de mantenibilidad que no rompe la ejecución |
| **Vulnerability** | Debilidad de seguridad explotable |
| **Security Hotspot** | Punto de seguridad que requiere revisión humana |
| **Quality Gate** | Conjunto de condiciones que debe cumplir el proyecto |
| **New Code** | Código nuevo o modificado desde la línea base |
| **ncloc** | Líneas de código no comentadas |
| **Deuda técnica** | Esfuerzo estimado para corregir code smells |
| **Complejidad cognitiva** | Esfuerzo mental para entender una función |
| **Cobertura** | Porcentaje de código ejecutado por las pruebas |
| **Clover / LCOV / Cobertura** | Formatos de reporte de cobertura |
| **SonarScanner** | Cliente que envía el análisis al servidor |
| **Sonar way** | Quality Gate integrado de SonarSource |
| **ISO/IEC 25010** | Modelo de calidad de producto de software |

### 24.4. Referencias

- SonarQube Server Documentation: `https://docs.sonarsource.com/sonarqube-server/`
- SonarScanner CLI: `https://docs.sonarsource.com/sonarqube-server/latest/analyzing-source-code/scanners/sonarscanner/`
- SonarQube Coverage: `https://docs.sonarsource.com/sonarqube-server/latest/analyzing-source-code/test-coverage/`
- Sonar Rules: `https://rules.sonarsource.com/`
- SonarQube Docker Image: `https://hub.docker.com/_/sonarqube`
- PHPUnit Coverage: `https://docs.phpunit.de/en/11.5/code-coverage.html`
- Vitest Coverage: `https://vitest.dev/guide/coverage.html`
- pytest-cov: `https://pytest-cov.readthedocs.io/`
- Laravel Testing: `https://laravel.com/docs/12.x/testing`
- GitHub Actions: `https://docs.github.com/actions`
- ISO/IEC 25010: `https://iso25000.com/index.php/en/iso-25000-standards/iso-25010`
- OWASP Top 10: `https://owasp.org/www-project-top-ten/`

### 24.5. Plantilla de registro de issues (CSV)

```csv
ID,Regla,Archivo,Linea,Tipo,Severidad,Calidad,Problema,Accion,Esfuerzo,Responsable,Estado,Evidencia
SQ-001,php:S1192,satre-backend/tests/Feature/AuthTest.php,18,CODE_SMELL,CRITICAL,MAINTAINABILITY,Literal /api/auth/login repetido 9 veces,Extraer constante,20min,Backend,Open,captura-issues.png
SQ-002,javascript:S3358,coar-alerta-frontend/src/pages/estudiante/IATutor.jsx,120,CODE_SMELL,MAJOR,MAINTAINABILITY,Ternario anidado,Extraer variable,15min,Frontend,Open,captura-issues.png
```

### 24.6. Ejemplo de salida del scanner

```text
INFO: Scanner configuration file: C:\sonar-scanner\conf\sonar-scanner.properties
INFO: Project root configuration file: C:\Proyecto\sonar-project.properties
INFO: Java 21.0.12 Temurin (64-bit)
INFO: Indexing files...
INFO: 486 files indexed
INFO: Importing C:\Proyecto\satre-backend\coverage.xml
INFO: Importing C:\Proyecto\coar-alerta-frontend\coverage\lcov.info
INFO: Importing C:\Proyecto\satre-analytics\coverage.xml
INFO: Analysis report generated in ...
INFO: Analysis report uploaded in ...
INFO: ANALYSIS SUCCESSFUL
INFO: EXECUTION SUCCESS
INFO: Analysis total time: 1:42.315 s
INFO: http://localhost:9000/dashboard?id=uc-group4612142_satre
```
