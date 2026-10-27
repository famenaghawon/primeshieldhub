# deploy-backend.ps1 - Deploy Worker + purge cache
# Requires: Wrangler OAuth login, $env:PSH_CACHE_TOKEN (optional)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$ZoneId     = "a7243eafbfa15ddd48f68aa97d544ff7"
$BackendDir = Join-Path $PSScriptRoot "backend"

Write-Host ""
Write-Host "[1/2] Deploying Cloudflare Worker..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackendDir)) {
    Write-Host "[ERROR] Backend directory not found: $BackendDir" -ForegroundColor Red
    exit 1
}

Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\CF_API_TOKEN         -ErrorAction SilentlyContinue

Push-Location $BackendDir
try {
    npx wrangler deploy
    if ($LASTEXITCODE -ne 0) { throw "wrangler deploy failed" }
}
finally {
    Pop-Location
}

$CacheToken = $env:PSH_CACHE_TOKEN

if (-not $CacheToken) {
    Write-Host ""
    Write-Host "[2/2] Skipping cache purge (PSH_CACHE_TOKEN not set)" -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "[2/2] Purging Cloudflare cache..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod `
            -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/purge_cache" `
            -Method POST `
            -Headers @{ "Authorization" = "Bearer $CacheToken"; "Content-Type" = "application/json" } `
            -Body '{"purge_everything":true}'
        if ($response.success) {
            Write-Host "      [OK] Cache purged" -ForegroundColor Green
        } else {
            Write-Host "      [WARN] Purge returned errors" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "      [WARN] Cache purge failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Backend deploy complete." -ForegroundColor Green
Write-Host ""
