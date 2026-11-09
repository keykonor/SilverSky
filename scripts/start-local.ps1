[CmdletBinding()]
param([switch] $OpenBrowser)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$frontend = Join-Path $project 'frontend'
$logDirectory = Join-Path $project '.verification\local-start'
$homepage = 'http://127.0.0.1:5173/'

function Test-SilverSkyApi([string] $Url) {
    try {
        $status = Invoke-RestMethod -Uri $Url -TimeoutSec 2
        return ($status.deepseek_configured -is [bool] -and $status.amap_configured -is [bool])
    } catch { return $false }
}

function Test-SilverSkyHome {
    try {
        $page = Invoke-WebRequest -Uri $homepage -UseBasicParsing -TimeoutSec 2
        return ($page.StatusCode -eq 200 -and $page.Content -match '<title>SilverSky')
    } catch { return $false }
}

function Start-SilverSkyService([int] $Port, [string] $Name, [scriptblock] $Ready, [scriptblock] $Launch) {
    if (& $Ready) { return }
    if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
        & $Launch
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(25)
    do {
        if (& $Ready) { return }
        Start-Sleep -Milliseconds 350
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$Name did not become ready on port $Port. Check port ownership and logs in $logDirectory."
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Start-SilverSkyService 8000 'SilverSky backend' { Test-SilverSkyApi 'http://127.0.0.1:8000/api/v2/status' } {
    $python = Join-Path $project '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw 'Python environment missing. Follow README.md setup first.' }
    Start-Process -FilePath $python -ArgumentList '-m','uvicorn','backend.app:app','--host','127.0.0.1','--port','8000','--no-access-log' `
        -WorkingDirectory $project -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDirectory 'backend-out.log') -RedirectStandardError (Join-Path $logDirectory 'backend-error.log')
}
Start-SilverSkyService 5173 'SilverSky frontend' { Test-SilverSkyHome } {
    if (-not (Test-Path -LiteralPath (Join-Path $frontend 'node_modules\vite\bin\vite.js') -PathType Leaf)) {
        throw 'Frontend dependencies missing. Run npm ci in the frontend directory.'
    }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort' `
        -WorkingDirectory $frontend -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDirectory 'frontend-out.log') -RedirectStandardError (Join-Path $logDirectory 'frontend-error.log')
}
if (-not (Test-SilverSkyApi ($homepage + 'api/v2/status'))) {
    throw "The homepage is up, but its API proxy is unavailable. Check logs in $logDirectory."
}
Write-Host "SilverSky ready: $homepage"
if ($OpenBrowser) { Start-Process $homepage }
