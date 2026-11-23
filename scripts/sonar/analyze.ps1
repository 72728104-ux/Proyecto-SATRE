<#
.SYNOPSIS
    Genera la cobertura de SATRE y ejecuta el análisis de SonarQube.

.DESCRIPTION
    Orquesta las tres suites del monorepo (Laravel/PHPUnit, React/Vitest y
    FastAPI/pytest), normaliza las rutas de los reportes para que Sonar las
    pueda asociar al proyecto y lanza SonarScanner desde la raíz.

    La cobertura del backend con Xdebug puede tardar bastante (más de 10
    minutos en un equipo de desarrollo). Para una ejecución rápida use
    -SkipTests si los reportes ya existen, o -SkipBackend si solo desea
    regenerar frontend/analytics.

.PARAMETER Token
    Token de análisis. Si se omite, se usa la variable de entorno SONAR_TOKEN.

.PARAMETER HostUrl
    URL del servidor SonarQube. Por defecto http://localhost:9000.
    Para SonarCloud use https://sonarcloud.io.

.PARAMETER Version
    Versión que se registrará en el análisis. Por defecto 1.0.0.

.PARAMETER SkipTests
    No ejecuta pruebas: usa los reportes de cobertura existentes y solo lanza
    el scanner.

.PARAMETER SkipBackend
    No regenera la cobertura del backend (útil si Xdebug tarda demasiado).

.PARAMETER UseDocker
    Ejecuta el scanner con la imagen sonarsource/sonar-scanner-cli en lugar
    del SonarScanner CLI instalado.

.PARAMETER WaitForQualityGate
    Espera el resultado del Quality Gate y devuelve error si no se cumple.
    Recomendado en CI; en local puede tardar unos segundos más.

.EXAMPLE
    $env:SONAR_TOKEN = "sqp_..."
    .\scripts\sonar\analyze.ps1

.EXAMPLE
    .\scripts\sonar\analyze.ps1 -SkipTests -WaitForQualityGate

.EXAMPLE
    .\scripts\sonar\analyze.ps1 -UseDocker -HostUrl http://localhost:9000
#>

[CmdletBinding()]
param(
    [string]$Token = $env:SONAR_TOKEN,
    [string]$HostUrl = $(if ($env:SONAR_HOST_URL) { $env:SONAR_HOST_URL } else { "http://localhost:9000" }),
    [string]$Version = "1.0.0",
    [switch]$SkipTests,
    [switch]$SkipBackend,
    [switch]$UseDocker,
    [switch]$WaitForQualityGate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Backend = Join-Path $RepoRoot "satre-backend"
$Frontend = Join-Path $RepoRoot "coar-alerta-frontend"
$Analytics = Join-Path $RepoRoot "satre-analytics"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontró '$Name'. $Hint"
    }
}

function Repair-LcovPaths {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Prefix
    )

    $lines = Get-Content -LiteralPath $Path
    $fixed = foreach ($line in $lines) {
        if ($line -match '^SF:(.+)$') {
            $file = $Matches[1] -replace '\\', '/'
            if (-not $file.StartsWith("$Prefix/")) {
                $file = "$Prefix/$file"
            }
            "SF:$file"
        }
        else {
            $line
        }
    }
    Set-Content -LiteralPath $Path -Value $fixed -Encoding utf8
    Write-Host "    lcov normalizado: $Path" -ForegroundColor DarkGray
}

function Repair-PythonCoveragePaths {
    param([Parameter(Mandatory)][string]$Path)

    $content = Get-Content -LiteralPath $Path -Raw
    # coverage.py escribe rutas absolutas; Sonar las resuelve mejor si la
    # fuente queda relativa a la raíz del monorepo.
    $content = [regex]::Replace(
        $content,
        '<source>.*?</source>',
        '<source>satre-analytics/app</source>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    Set-Content -LiteralPath $Path -Value $content -Encoding utf8 -NoNewline
    Write-Host "    coverage.xml de Python normalizado: $Path" -ForegroundColor DarkGray
}

function Repair-PhpCloverPaths {
    param([Parameter(Mandatory)][string]$Path)

    $content = Get-Content -LiteralPath $Path -Raw
    $content = [regex]::Replace(
        $content,
        '(<file name=")([^"]+)(")',
        {
            param($m)
            $file = $m.Groups[2].Value -replace '\\', '/'
            if ($file -notmatch '^([A-Za-z]:/|/)') {
                if (-not $file.StartsWith('satre-backend/')) {
                    $file = "satre-backend/$file"
                }
            }
            $m.Groups[1].Value + $file + $m.Groups[3].Value
        }
    )
    Set-Content -LiteralPath $Path -Value $content -Encoding utf8 -NoNewline
    Write-Host "    Clover de PHP normalizado: $Path" -ForegroundColor DarkGray
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "Falta el token. Defina `$env:SONAR_TOKEN o use -Token 'sqp_...'."
}

if (-not $UseDocker) {
    Assert-Command -Name "sonar-scanner" -Hint "Instale SonarScanner CLI y agregue C:\sonar-scanner\bin al PATH, o use -UseDocker."
}

if (-not (Test-Path (Join-Path $RepoRoot "sonar-project.properties"))) {
    throw "No se encontró sonar-project.properties en $RepoRoot."
}

# ---------------------------------------------------------------------------
# 1. Backend Laravel: PHPUnit + Xdebug/PCOV -> satre-backend/coverage.xml
# ---------------------------------------------------------------------------
if (-not $SkipTests -and -not $SkipBackend) {
    Write-Step "Backend: pruebas y cobertura (puede tardar varios minutos)"
    Assert-Command -Name "php" -Hint "Instale PHP 8.2+ y agréguelo al PATH."

    $modules = & php -m
    if (-not ($modules -match 'xdebug|pcov')) {
        throw "PHP no tiene Xdebug ni PCOV habilitados. Active uno de los dos para generar cobertura."
    }

    Push-Location $Backend
    try {
        $oldMode = $env:XDEBUG_MODE
        $env:XDEBUG_MODE = "coverage"
        & php artisan test --coverage-clover=coverage.xml
        if ($LASTEXITCODE -ne 0) {
            throw "Las pruebas del backend fallaron. Corrija los errores antes de analizar."
        }
    }
    finally {
        if ($null -eq $oldMode) { Remove-Item Env:XDEBUG_MODE -ErrorAction SilentlyContinue }
        else { $env:XDEBUG_MODE = $oldMode }
        Pop-Location
    }

    $phpCoverage = Join-Path $Backend "coverage.xml"
    if (-not (Test-Path $phpCoverage)) {
        throw "No se generó $phpCoverage."
    }
    Repair-PhpCloverPaths -Path $phpCoverage
}

# ---------------------------------------------------------------------------
# 2. Frontend React: Vitest + V8 -> coar-alerta-frontend/coverage/lcov.info
# ---------------------------------------------------------------------------
if (-not $SkipTests) {
    Write-Step "Frontend: pruebas y cobertura"
    Assert-Command -Name "npm" -Hint "Instale Node.js 22+ y npm."

    Push-Location $Frontend
    try {
        & npm run test -- --coverage
        if ($LASTEXITCODE -ne 0) {
            throw "Las pruebas del frontend fallaron. Corrija los errores antes de analizar."
        }
    }
    finally {
        Pop-Location
    }

    $lcov = Join-Path $Frontend "coverage/lcov.info"
    if (-not (Test-Path $lcov)) {
        throw "No se generó $lcov. Revise que vite.config.js incluya el reporter 'lcov'."
    }
    Repair-LcovPaths -Path $lcov -Prefix "coar-alerta-frontend"
}

# ---------------------------------------------------------------------------
# 3. Analytics: pytest-cov -> satre-analytics/coverage.xml
# ---------------------------------------------------------------------------
if (-not $SkipTests) {
    Write-Step "Analytics: pruebas y cobertura"
    $venvPython = Join-Path $Analytics ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        $venvPython = Join-Path $Analytics "venv\Scripts\python.exe"
    }
    if (-not (Test-Path $venvPython)) {
        $venvPython = "python"
    }

    Push-Location $Analytics
    try {
        & $venvPython -m pytest --cov=app --cov-report=xml:coverage.xml --cov-report=term-missing
        if ($LASTEXITCODE -ne 0) {
            throw "Las pruebas de analytics fallaron. Corrija los errores antes de analizar."
        }
    }
    finally {
        Pop-Location
    }

    $pyCoverage = Join-Path $Analytics "coverage.xml"
    if (-not (Test-Path $pyCoverage)) {
        throw "No se generó $pyCoverage. Instale pytest-cov (pip install pytest-cov)."
    }
    Repair-PythonCoveragePaths -Path $pyCoverage
}

# ---------------------------------------------------------------------------
# 4. SonarScanner
# ---------------------------------------------------------------------------
Write-Step "SonarScanner: análisis del monorepo"

$scannerArgs = @(
    "-Dsonar.projectVersion=$Version"
)
if ($WaitForQualityGate) {
    $scannerArgs += "-Dsonar.qualitygate.wait=true"
}

Push-Location $RepoRoot
try {
    if ($UseDocker) {
        $dockerHost = $HostUrl
        if ($dockerHost -match 'localhost|127\.0\.0\.1') {
            $dockerHost = $dockerHost -replace 'localhost', 'host.docker.internal' -replace '127\.0\.0\.1', 'host.docker.internal'
        }
        Write-Host "    Ejecutando scanner en Docker contra $dockerHost" -ForegroundColor DarkGray
        & docker run --rm `
            -v "${RepoRoot}:/usr/src" `
            -e "SONAR_HOST_URL=$dockerHost" `
            -e "SONAR_TOKEN=$Token" `
            sonarsource/sonar-scanner-cli @scannerArgs
    }
    else {
        & sonar-scanner "-Dsonar.host.url=$HostUrl" "-Dsonar.token=$Token" @scannerArgs
    }

    if ($LASTEXITCODE -ne 0) {
        throw "SonarScanner terminó con errores (código $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Análisis completado. Dashboard: $HostUrl/dashboard?id=uc-group4612142_satre" -ForegroundColor Green
