# test-api.ps1
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Testing PrimeShieldHub API" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Test 1: Health
Write-Host "`n[1] Testing /api/_health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -UseBasicParsing https://api.primeshieldhub.com/api/_health
    Write-Host "✅ Health Check: PASSED" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Root
Write-Host "`n[2] Testing / ..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -UseBasicParsing https://api.primeshieldhub.com/
    Write-Host "✅ Root: PASSED" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Root: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Products
Write-Host "`n[3] Testing /api/products ..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -UseBasicParsing https://api.primeshieldhub.com/api/products
    Write-Host "✅ Products: PASSED" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Products: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Remote Config
Write-Host "`n[4] Testing /api/config/remote ..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -UseBasicParsing https://api.primeshieldhub.com/api/config/remote
    Write-Host "✅ Remote Config: PASSED" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Remote Config: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
