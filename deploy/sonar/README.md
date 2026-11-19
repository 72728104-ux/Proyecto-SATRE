# SonarQube local para SATRE

Este directorio contiene una forma reproducible de levantar SonarQube
Community para analizar el monorepo SATRE.

## Requisitos

- Docker Desktop iniciado (motor Linux).
- Puerto 9000 libre.
- Al menos 4 GB de memoria disponible para Docker.

## Levantar

```powershell
cd C:\Proyecto\deploy\sonar
docker compose up -d
docker compose logs -f sonarqube
```

Espere hasta que `http://localhost:9000/api/system/health` responda `GREEN`.
La primera vez puede tardar entre 2 y 5 minutos.

## Detener / reiniciar / eliminar

```powershell
docker compose stop
docker compose start
docker compose down          # conserva los volúmenes
docker compose down -v       # elimina también los datos (irreversible)
```

## Relación con la guía

La guía principal está en `docs/sonar/GUIA_SONARQUBE_SATRE.md` y su versión
Word en `docs/sonar/GUIA_SONARQUBE_SATRE.docx`.

La configuración del análisis está en `sonar-project.properties`, en la raíz
del repositorio. El script `scripts/sonar/analyze.ps1` genera la cobertura y
ejecuta el scanner.
