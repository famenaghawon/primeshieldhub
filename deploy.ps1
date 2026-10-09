# deploy.ps1 - Deploy frontend to Cloudflare Pages + purge cache
# Requires: Wrangler OAuth login, $env:PSH_CACHE_TOKEN
# v2: Added automatic retry with exponential backoff for 429 rate limits

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$ProjectName = "primeshieldhub"
$ZoneId      = "a7243eafbfa15ddd48f68aa97d544ff7"
$FrontendDir = Join-Path $PSScriptRoot "frontend"

# ============================================================
# RETRY CONFIG
# ============================================================
$MaxRetries   = 5              # Total attempts
$InitialWait  = 30             # Seconds before 1st retry (doubles each time)
$MaxWait      = 300            # Cap per retry at 5 minutes

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

# Clear any token env vars that might force API-key mode
Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\CF_API_TOKEN         -ErrorAction SilentlyContinue

$attempt       = 0
$deploySuccess = $false
$lastError     = ""

Push-Location $FrontendDir
try {
    while ($attempt -lt $MaxRetries -and -not $deploySuccess) {
        $attempt++

        # --- Wait between retries (exponential backoff) ---
        if ($attempt -gt 1) {
            $waitSeconds = [Math]::Min($InitialWait * [Math]::Pow(2, $attempt - 2), $MaxWait)
            Write-Host ""
            Write-Host "   [WAIT] Rate limit detected. Sleeping $waitSeconds s before retry $attempt/$MaxRetries..." -ForegroundColor Yellow
            Write-Host "          (started at $(Get-Date -Format 'HH:mm:ss'), will retry at $((Get-Date).AddSeconds($waitSeconds).ToString('HH:mm:ss')))" -ForegroundColor DarkGray
            Start-Sleep -Seconds $waitSeconds
            Write-Host "   [WAIT] Resuming now." -ForegroundColor DarkGray
            Write-Host ""
        }

        Write-Host "   [TRY ] Attempt $attempt of $MaxRetries..." -ForegroundColor DarkGray

        # --- Run wrangler and capture ALL output ---
        $output = & npx wrangler pages deploy public --project-name=$ProjectName --commit-dirty=true 2>&1
        $exitCode = $LASTEXITCODE

        # Echo the output so the user sees it
        $output | ForEach-Object { Write-Host $_ }

        # --- Analyze result ---
        $outputText = ($output | Out-String)

        if ($exitCode -eq 0) {
            $deploySuccess = $true
            Write-Host ""
            Write-Host "   [ OK ] Frontend deploy succeeded on attempt $attempt" -ForegroundColor Green
        }
        elseif ($outputText -match "429|Too Many Requests|rate limit|Rate limit") {
            $lastError = "Rate limited by Cloudflare (HTTP 429)"
            Write-Host ""
            Write-Host "   [429 ] Cloudflare rate limit hit." -ForegroundColor Yellow
            # Loop will retry with backoff
        }
        elseif ($outputText -match "malformed response") {
            $lastError = "Malformed response from Cloudflare API (likely 429 under the hood)"
            Write-Host ""
            Write-Host "   [WARN] Malformed response — treating as possible rate limit." -ForegroundColor Yellow
            # Loop will retry
        }
        else {
            # Non-retryable error — bail out immediately
            Write-Host ""
            Write-Host "   [FAIL] Deploy failed with a non-retryable error (exit $exitCode)." -ForegroundColor Red
            throw "wrangler pages deploy failed with exit code $exitCode"
        }
    }

    if (-not $deploySuccess) {
        Write-Host ""
        Write-Host "   [FAIL] All $MaxRetries attempts failed. Last error: $lastError" -ForegroundColor Red
        Write-Host "   [TIP ] Wait 10-15 minutes, then run .\deploy.ps1 again." -ForegroundColor Yellow
        throw "wrangler pages deploy failed after $MaxRetries attempts ($lastError)"
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

    $purgeSuccess = $false
    $purgeAttempt = 0
    $purgeMax     = 3

    while ($purgeAttempt -lt $purgeMax -and -not $purgeSuccess) {
        $purgeAttempt++
        try {
            $response = Invoke-RestMethod `
                -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/purge_cache" `
                -Method POST `
                -Headers @{ "Authorization" = "Bearer $CacheToken"; "Content-Type" = "application/json" } `
                -Body '{"purge_everything":true}'

            if ($response.success) {
                Write-Host "      [OK] Cache purged" -ForegroundColor Green
                $purgeSuccess = $true
            } else {
                Write-Host "      [WARN] Purge returned errors:" -ForegroundColor Yellow
                $response.errors | ForEach-Object { Write-Host "             - $($_.message)" -ForegroundColor Yellow }
                break
            }
        }
        catch {
            $statusCode = $null
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
            if ($statusCode -eq 429 -and $purgeAttempt -lt $purgeMax) {
                $wait = 30 * $purgeAttempt
                Write-Host "      [WAIT] Purge rate limited. Sleeping $wait s before retry $purgeAttempt/$purgeMax..." -ForegroundColor Yellow
                Start-Sleep -Seconds $wait
            } else {
                Write-Host "      [WARN] Cache purge failed: $($_.Exception.Message)" -ForegroundColor Yellow
                break
            }
        }
    }
}

Write-Host ""
Write-Host "Frontend deploy complete." -ForegroundColor Green
Write-Host ""
