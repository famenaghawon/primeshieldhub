# deploy.ps1 - Deploy frontend to Cloudflare Pages + purge cache
# Requires: Wrangler OAuth login, $env:PSH_CACHE_TOKEN (optional)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$ProjectName = "primeshieldhub"
$ZoneId      = "a7243eafbfa15ddd48f68aa97d544ff7"
$FrontendDir = Join-Path $PSScriptRoot "frontend"

# ============================================================
# RETRY CONFIG
# ============================================================
$MaxRetries  = 5
$InitialWait = 30
$MaxWait     = 300

# ============================================================
# [1/2] FRONTEND DEPLOY
# ============================================================
Write-Host ""
Write-Host "[1/2] Deploying frontend to Cloudflare Pages..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $FrontendDir)) {
    Write-Host "[ERROR] Frontend directory not found: $FrontendDir" -ForegroundColor Red
    exit 1
}

Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\CF_API_TOKEN         -ErrorAction SilentlyContinue

$attempt       = 0
$deploySuccess = $false
$lastError     = ""

Push-Location $FrontendDir
try {
    while ($attempt -lt $MaxRetries -and -not $deploySuccess) {
        $attempt++

        if ($attempt -gt 1) {
            $waitSeconds = [Math]::Min($InitialWait * [Math]::Pow(2, $attempt - 2), $MaxWait)
            Write-Host "   [WAIT] Rate limit detected. Sleeping $waitSeconds s before retry attempt $attempt/$MaxRetries..." -ForegroundColor Yellow
            Start-Sleep -Seconds $waitSeconds
        }

        Write-Host "   [TRY ] Attempt $attempt of $MaxRetries..." -ForegroundColor DarkGray

        # Temporarily ignore Stop on stderr to catch warnings
        $oldEA = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        # Use --branch to avoid worker config confusion, and remove 2>&1
        $output = & npx wrangler pages deploy public --project-name=$ProjectName --commit-dirty=true 2>&1
        $exitCode = $LASTEXITCODE

        # Restore ErrorActionPreference
        $ErrorActionPreference = $oldEA

        $output | ForEach-Object { Write-Host $_ }
        $outputText = ($output | Out-String)

        if ($exitCode -eq 0) {
            $deploySuccess = $true
            Write-Host ""
            Write-Host "   [ OK ] Frontend deploy succeeded on attempt $attempt" -ForegroundColor Green
        }
        elseif ($outputText -match "429|Too Many Requests|rate limit|Rate limit|malformed response") {
            $lastError = "Rate limited by Cloudflare (HTTP 429)"
            Write-Host ""
            Write-Host "   [429 ] Cloudflare rate limit hit." -ForegroundColor Yellow
        }
        else {
            Write-Host ""
            Write-Host "   [FAIL] Deploy failed with a non-retryable error (exit $exitCode)." -ForegroundColor Red
            throw "wrangler pages deploy failed with exit code $exitCode"
        }
    }

    if (-not $deploySuccess) {
        throw "wrangler pages deploy failed after $MaxRetries attempts. Last error: $lastError"
    }
}
finally {
    Pop-Location
}

# ============================================================
# [2/2] CACHE PURGE
# ============================================================
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
Write-Host "Frontend deploy complete." -ForegroundColor Green
Write-Host ""
