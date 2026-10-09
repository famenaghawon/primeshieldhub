# API Consistency Audit - PRIMESHIELDHUB
# Save this as api-audit.ps1 and run from project root

$Report = @()
$FrontendCalls = @()
$BackendRoutes = @()
$AuthEndpoints = @()
$Headers = @()
$Sessions = @()
$JWTRefs = @()
$LocalStorage = @()

Write-Host "🔍 Starting API Consistency Audit..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Frontend API calls
Write-Host "`n📱 Finding frontend API calls..." -ForegroundColor Yellow
$FrontendCalls = Get-ChildItem . -Recurse -Include *.js,*.html,*.ts,*.tsx,*.jsx -ErrorAction SilentlyContinue |
    Select-String -Pattern "/api/","fetch\(","apiRequest\(","axios","API_BASE" |
    Select-Object Path, LineNumber, Line

# Step 2: Backend routes
Write-Host "`n🔧 Finding backend routes..." -ForegroundColor Yellow
$BackendRoutes = Get-ChildItem backend -Recurse -Include *.js,*.ts -ErrorAction SilentlyContinue |
    Select-String -Pattern "app\.(get|post|put|delete|patch)","router\.(get|post|put|delete|patch)",".get\(",".post\(",".put\(",".delete\(",".patch\(","/api/","route\(","app\.route" |
    Select-Object Path, LineNumber, Line

# Step 3: Auth endpoints
Write-Host "`n🔐 Finding auth endpoints..." -ForegroundColor Yellow
$AuthEndpoints = Get-ChildItem . -Recurse -Include *.js,*.ts,*.html,*.tsx,*.jsx -ErrorAction SilentlyContinue |
    Select-String -Pattern "/auth/" |
    Select-Object Path, LineNumber, Line

# Step 4: Authorization headers
Write-Host "`n🔑 Finding Authorization headers..." -ForegroundColor Yellow
$Headers = Get-ChildItem . -Recurse -Include *.js,*.ts,*.html,*.tsx,*.jsx -ErrorAction SilentlyContinue |
    Select-String -Pattern "Authorization" |
    Select-Object Path, LineNumber, Line

# Step 5: Session IDs
Write-Host "`n🎫 Finding sessionId references..." -ForegroundColor Yellow
$Sessions = Get-ChildItem . -Recurse -Include *.js,*.ts,*.tsx,*.jsx -ErrorAction SilentlyContinue |
    Select-String -Pattern "sessionId" |
    Select-Object Path, LineNumber, Line

# Step 6: JWT references
Write-Host "`n🪪 Finding JWT references..." -ForegroundColor Yellow
$JWTRefs = Get-ChildItem . -Recurse -Include *.js,*.ts,*.tsx,*.jsx -ErrorAction SilentlyContinue |
    Select-String -Pattern "jwt","JWT","verify","sign","Bearer" |
    Select-Object Path, LineNumber, Line

# Step 7: localStorage keys
Write-Host "`n💾 Finding localStorage usage..." -ForegroundColor Yellow
$LocalStorage = Get-ChildItem . -Recurse -Include *.js,*.ts,*.html,*.tsx,*.jsx -ErrorAction SilentlyContinue |
    Select-String -Pattern "localStorage" |
    Select-Object Path, LineNumber, Line

# Generate Audit Report
Write-Host "`n📊 Generating audit report..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Extract endpoints from frontend
$FrontendEndpoints = @()
foreach ($match in $FrontendCalls) {
    if ($match.Line -match '["''](/api/[^"''\s)]+)["'']') {
        $FrontendEndpoints += $matches[1]
    }
    if ($match.Line -match 'fetch\(["'']([^"''\s)]+)["'']') {
        $FrontendEndpoints += $matches[1]
    }
    if ($match.Line -match 'axios\.(get|post|put|delete)\(["'']([^"''\s)]+)["'']') {
        $FrontendEndpoints += $matches[2]
    }
}

# Extract endpoints from backend
$BackendEndpoints = @()
foreach ($match in $BackendRoutes) {
    if ($match.Line -match '["''](/api/[^"''\s)]+)["'']') {
        $BackendEndpoints += $matches[1]
    }
    if ($match.Line -match '\.(get|post|put|delete|patch)\(["'']([^"''\s)]+)["'']') {
        $BackendEndpoints += $matches[2]
    }
}

# Find unique endpoints
$UniqueFrontend = $FrontendEndpoints | Sort-Object -Unique
$UniqueBackend = $BackendEndpoints | Sort-Object -Unique

# Count files
$FrontendFiles = Get-ChildItem . -Recurse -Include *.js,*.html,*.ts,*.tsx,*.jsx -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
$BackendFiles = Get-ChildItem backend -Recurse -Include *.js,*.ts -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count

# Find localStorage keys
$StorageKeys = @()
foreach ($match in $LocalStorage) {
    if ($match.Line -match "localStorage\.(get|set|remove)Item\(['""]([^'""]+)['""]") {
        $StorageKeys += $matches[2]
    }
}
$UniqueStorageKeys = $StorageKeys | Sort-Object -Unique

# Create summary
$Summary = @"
========================================
📋 API CONSISTENCY AUDIT SUMMARY
========================================

📱 FRONTEND ANALYSIS:
- Total files scanned: $FrontendFiles
- Unique API endpoints found: $($UniqueFrontend.Count)
- Total API calls found: $($FrontendCalls.Count)

🔧 BACKEND ANALYSIS:
- Total files scanned: $BackendFiles
- Unique API endpoints found: $($UniqueBackend.Count)
- Total route definitions: $($BackendRoutes.Count)

🔐 AUTHENTICATION:
- Auth endpoints found: $($AuthEndpoints.Count)
- Authorization headers: $($Headers.Count)
- Session ID references: $($Sessions.Count)
- JWT references: $($JWTRefs.Count)

💾 STORAGE:
- localStorage usage: $($LocalStorage.Count)
- Storage keys found: $($UniqueStorageKeys -join ", ")

========================================
🔍 MISMATCH DETECTION
========================================

Endpoints found in FRONTEND but NOT in BACKEND:
$($UniqueFrontend | Where-Object { $_ -notin $UniqueBackend } | ForEach-Object { "  - $_" } | Join-String -Separator "`n")

Endpoints found in BACKEND but NOT in FRONTEND:
$($UniqueBackend | Where-Object { $_ -notin $UniqueFrontend } | ForEach-Object { "  - $_" } | Join-String -Separator "`n")

========================================
⚠️  RED FLAGS
========================================

Potential duplicate auth handlers:
$(if ($AuthEndpoints.Count -gt 0) {
    $AuthEndpoints | ForEach-Object { 
        if ($_.Line -match '(/auth/[^"''\s)]+)') {
            $matches[1]
        }
    } | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { "  - $($_.Name) appears $($_.Count) times" }
} else {
    "  None found"
} | Join-String -Separator "`n")

========================================
📊 DETAILED ENDPOINT TABLE
========================================

Endpoint | Frontend | Backend | Status
"@

$TableRows = @()
$AllEndpoints = ($UniqueFrontend + $UniqueBackend) | Sort-Object -Unique
foreach ($endpoint in $AllEndpoints) {
    $inFrontend = $endpoint -in $UniqueFrontend
    $inBackend = $endpoint -in $UniqueBackend
    $status = if ($inFrontend -and $inBackend) { "✅ OK" } elseif ($inFrontend) { "⚠️  Missing Backend" } else { "⚠️  Unused Backend" }
    $TableRows += "$endpoint | $inFrontend | $inBackend | $status"
}

$Summary + "`n" + ($TableRows | Join-String -Separator "`n")

# Save detailed report
$ReportPath = "api-audit-report.txt"
$Summary | Out-File -FilePath $ReportPath -Encoding UTF8

Write-Host "`n✅ Audit complete! Detailed report saved to: $ReportPath" -ForegroundColor Green

# Show critical findings summary
Write-Host "`n🚨 CRITICAL FINDINGS:" -ForegroundColor Red
$mismatches = $UniqueFrontend | Where-Object { $_ -notin $UniqueBackend }
if ($mismatches) {
    Write-Host "  ⚠️  $($mismatches.Count) frontend endpoints missing from backend" -ForegroundColor Yellow
    $mismatches | ForEach-Object { Write-Host "    - $_" -ForegroundColor Gray }
}

$unused = $UniqueBackend | Where-Object { $_ -notin $UniqueFrontend }
if ($unused) {
    Write-Host "  ⚠️  $($unused.Count) backend endpoints never called by frontend" -ForegroundColor Yellow
    $unused | ForEach-Object { Write-Host "    - $_" -ForegroundColor Gray }
}

# Check for auth inconsistencies
$authCalls = $FrontendCalls | Where-Object { $_.Line -match '/auth/' }
if ($authCalls) {
    Write-Host "`n  🔐 Auth endpoints called from frontend:" -ForegroundColor Cyan
    $authCalls | ForEach-Object { 
        if ($_.Line -match '(/auth/[^"''\s)]+)') {
            Write-Host "    - $($matches[1]) (in $($_.Path))" -ForegroundColor Gray
        }
    }
}

# Check for auth handlers in backend
$authHandlers = $BackendRoutes | Where-Object { $_.Line -match '/auth/' }
if ($authHandlers) {
    Write-Host "`n  🔧 Auth handlers in backend:" -ForegroundColor Cyan
    $authHandlers | ForEach-Object { 
        if ($_.Line -match '(/auth/[^"''\s)]+)') {
            Write-Host "    - $($matches[1]) (in $($_.Path))" -ForegroundColor Gray
        }
    }
}
