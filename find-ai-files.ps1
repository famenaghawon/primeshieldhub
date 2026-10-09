# ======================================================================
# FIND AI FILES - PrimeShieldHub Project
# Scans for all AI-related files and analyzes which need product DB integration
# ======================================================================

Write-Host "🔍 PRIMESHIELDHUB AI FILE SCANNER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set your project root path (change this to your actual path)
$projectRoot = "C:\Users\myori\Desktop\primeshieldhub"  # <-- CHANGE THIS
# Or use current directory:
# $projectRoot = Get-Location

if (!(Test-Path $projectRoot)) {
    Write-Host "❌ Project path not found: $projectRoot" -ForegroundColor Red
    Write-Host "Please set the correct path in the script." -ForegroundColor Yellow
    exit 1
}

Write-Host "📂 Scanning project: $projectRoot" -ForegroundColor Green
Write-Host ""

# ======================================================================
# 1. FIND ALL AI-RELATED FILES
# ======================================================================

$aiExtensions = @(".js", ".ts", ".jsx", ".tsx", ".html", ".htm")
$aiPatterns = @(
    "ai", "chat", "assistant", "gemini", "openai", "anthropic", "claude",
    "llm", "conversation", "bot", "message", "inference", "prompt"
)

$foundFiles = @()

foreach ($pattern in $aiPatterns) {
    $foundFiles += Get-ChildItem -Path $projectRoot -Recurse -File |
        Where-Object { 
            $_.Name -match $pattern -and 
            $aiExtensions -contains $_.Extension
        } |
        Select-Object FullName, Name, Directory, Extension
}

$foundFiles = $foundFiles | Sort-Object -Property FullName -Unique

# ======================================================================
# 2. CATEGORIZE AI FILES
# ======================================================================

$backendFiles = @()
$frontendFiles = @()
$htmlFiles = @()
$unknownFiles = @()

foreach ($file in $foundFiles) {
    $path = $file.FullName
    
    if ($path -match "src\\") {
        $backendFiles += $file
    } 
    elseif ($path -match "public\\") {
        $frontendFiles += $file
    }
    elseif ($path -match "\\pages\\" -or $path -match "\\templates\\") {
        $htmlFiles += $file
    }
    elseif ($path -match "\\.html$") {
        $htmlFiles += $file
    }
    else {
        $unknownFiles += $file
    }
}

# ======================================================================
# 3. ANALYZE EACH FILE FOR PRODUCT DB INTEGRATION
# ======================================================================

Write-Host "📊 AI FILE ANALYSIS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if file has product DB integration
function Test-ProductDBIntegration {
    param($filePath)
    
    if (!(Test-Path $filePath)) { return $false }
    
    $content = Get-Content -Path $filePath -Raw -ErrorAction SilentlyContinue
    if (!$content) { return $false }
    
    $patterns = @(
        "SELECT.*FROM products",
        "product_id",
        "products\.find",
        "Product\.",
        "productDatabase",
        "getProduct",
        "productTable",
        "DB\.prepare.*products",
        "inventory",
        "stock"
    )
    
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            return $true
        }
    }
    return $false
}

# Function to check if file handles purchase flow
function Test-PurchaseHandling {
    param($filePath)
    
    if (!(Test-Path $filePath)) { return $false }
    
    $content = Get-Content -Path $filePath -Raw -ErrorAction SilentlyContinue
    if (!$content) { return $false }
    
    $patterns = @(
        "addToCart",
        "add_to_cart",
        "checkout",
        "purchase",
        "cart",
        "order",
        "buy"
    )
    
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            return $true
        }
    }
    return $false
}

# ======================================================================
# 4. DISPLAY RESULTS
# ======================================================================

Write-Host "🔹 BACKEND AI FILES (src/) - ${$backendFiles.Count} files found" -ForegroundColor Yellow
Write-Host "------------------------------------------------" -ForegroundColor Gray
foreach ($file in $backendFiles) {
    $hasDB = Test-ProductDBIntegration $file.FullName
    $hasPurchase = Test-PurchaseHandling $file.FullName
    
    $status = if ($hasDB) { "✅ Has product DB" } else { "❌ NEEDS PRODUCT DB FIX" }
    $purchase = if ($hasPurchase) { "✅ Has purchase flow" } else { "⚠️ Needs purchase flow" }
    
    Write-Host "  📄 $($file.Name)" -ForegroundColor White
    Write-Host "     📁 $($file.Directory)" -ForegroundColor Gray
    Write-Host "     $status" -ForegroundColor $(if ($hasDB) { "Green" } else { "Red" })
    Write-Host "     $purchase" -ForegroundColor $(if ($hasPurchase) { "Green" } else { "Yellow" })
    Write-Host ""
}

Write-Host ""
Write-Host "🔹 FRONTEND AI FILES (public/) - ${$frontendFiles.Count} files found" -ForegroundColor Yellow
Write-Host "------------------------------------------------" -ForegroundColor Gray
foreach ($file in $frontendFiles) {
    $hasDB = Test-ProductDBIntegration $file.FullName
    $hasPurchase = Test-PurchaseHandling $file.FullName
    
    $status = if ($hasDB) { "✅ Has product DB" } else { "❌ NEEDS PRODUCT DB FIX" }
    $purchase = if ($hasPurchase) { "✅ Has purchase flow" } else { "⚠️ Needs purchase flow" }
    
    Write-Host "  📄 $($file.Name)" -ForegroundColor White
    Write-Host "     📁 $($file.Directory)" -ForegroundColor Gray
    Write-Host "     $status" -ForegroundColor $(if ($hasDB) { "Green" } else { "Red" })
    Write-Host "     $purchase" -ForegroundColor $(if ($hasPurchase) { "Green" } else { "Yellow" })
    Write-Host ""
}

Write-Host ""
Write-Host "🔹 HTML AI FILES (pages/) - ${$htmlFiles.Count} files found" -ForegroundColor Yellow
Write-Host "------------------------------------------------" -ForegroundColor Gray
foreach ($file in $htmlFiles) {
    $hasDB = Test-ProductDBIntegration $file.FullName
    $hasPurchase = Test-PurchaseHandling $file.FullName
    
    $status = if ($hasDB) { "✅ Has product DB" } else { "❌ NEEDS PRODUCT DB FIX" }
    $purchase = if ($hasPurchase) { "✅ Has purchase flow" } else { "⚠️ Needs purchase flow" }
    
    Write-Host "  📄 $($file.Name)" -ForegroundColor White
    Write-Host "     📁 $($file.Directory)" -ForegroundColor Gray
    Write-Host "     $status" -ForegroundColor $(if ($hasDB) { "Green" } else { "Red" })
    Write-Host "     $purchase" -ForegroundColor $(if ($hasPurchase) { "Green" } else { "Yellow" })
    Write-Host ""
}

# ======================================================================
# 5. GENERATE FIX SUMMARY
# ======================================================================

Write-Host ""
Write-Host "📋 FIX SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$needsFix = @()
$needsPurchase = @()

foreach ($file in $foundFiles) {
    if (!(Test-ProductDBIntegration $file.FullName)) {
        $needsFix += $file
    }
    if (!(Test-PurchaseHandling $file.FullName)) {
        $needsPurchase += $file
    }
}

Write-Host "🔴 Files needing PRODUCT DB integration (${$needsFix.Count}):" -ForegroundColor Red
foreach ($file in $needsFix) {
    Write-Host "  - $($file.Name) (📁 $($file.Directory))" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🟡 Files needing PURCHASE flow integration (${$needsPurchase.Count}):" -ForegroundColor Yellow
foreach ($file in $needsPurchase) {
    Write-Host "  - $($file.Name) (📁 $($file.Directory))" -ForegroundColor Yellow
}

# ======================================================================
# 6. SAVE RESULTS TO FILE
# ======================================================================

$outputFile = Join-Path $projectRoot "ai_analysis_report.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$report = @"
==================================================
AI FILES ANALYSIS REPORT - PrimeShieldHub
Generated: $timestamp
==================================================

TOTAL AI FILES FOUND: $($foundFiles.Count)

BACKEND FILES (src/): $($backendFiles.Count)
FRONTEND FILES (public/): $($frontendFiles.Count)
HTML FILES: $($htmlFiles.Count)

==================================================
FILES NEEDING PRODUCT DB INTEGRATION
==================================================
"@

foreach ($file in $needsFix) {
    $report += "`n📄 $($file.Name)`n   📁 $($file.Directory)`n"
}

$report += @"

==================================================
FILES NEEDING PURCHASE FLOW INTEGRATION
==================================================
"@

foreach ($file in $needsPurchase) {
    $report += "`n📄 $($file.Name)`n   📁 $($file.Directory)`n"
}

$report += @"

==================================================
RECOMMENDED FIX: Add product database integration
==================================================

Add this code to your AI handler:

async function searchProducts(query, env) {
  const results = await env.DB.prepare(`
    SELECT id, name, price, stock, description, category, image_url
    FROM products 
    WHERE LOWER(name) LIKE ? 
       OR LOWER(category) LIKE ?
       OR LOWER(description) LIKE ?
    ORDER BY stock DESC
    LIMIT 10
  `).bind(`%${query}%`, `%${query}%`, `%${query}%`).all();
  return results.results || [];
}
"@

$report | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "✅ Report saved to: $outputFile" -ForegroundColor Green

# ======================================================================
# 7. RECOMMENDED FILES TO FIX (Based on your AI Assistant screenshot)
# ======================================================================

Write-Host ""
Write-Host "🎯 RECOMMENDED FILES TO FIX FIRST" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "Based on your AI Assistant screenshot showing 'do you have itel power tank?'"
Write-Host "The AI handler that processed this query needs to be fixed."
Write-Host ""
Write-Host "Look for files named:"
Write-Host "  - ai.js / ai-handler.js / assistant.js" -ForegroundColor Cyan
Write-Host "  - chat.js / chat-handler.js" -ForegroundColor Cyan
Write-Host "  - gemini.js / openai.js" -ForegroundColor Cyan
Write-Host "  - index.js (if it contains AI routes)" -ForegroundColor Cyan
Write-Host "  - Any file with '/api/ai' or '/api/chat' routes" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔍 Check these common paths:" -ForegroundColor Yellow
Write-Host "  - src/index.js (main router)" -ForegroundColor Gray
Write-Host "  - src/handlers/ai.js" -ForegroundColor Gray
Write-Host "  - src/handlers/chat.js" -ForegroundColor Gray
Write-Host "  - src/routes/ai.js" -ForegroundColor Gray
Write-Host "  - src/api/ai.js" -ForegroundColor Gray

# ======================================================================
# 8. QUICK SEARCH FOR AI ROUTES
# ======================================================================

Write-Host ""
Write-Host "🔍 SEARCHING FOR AI ROUTES..." -ForegroundColor Cyan
Write-Host ""

$aiRoutes = Get-ChildItem -Path $projectRoot -Recurse -File -Include "*.js", "*.ts" |
    Select-String -Pattern "('/api/ai'|'/api/chat'|'/ai'|'chatbot'|'assistant')" |
    Select-Object -Unique Filename, Line

if ($aiRoutes) {
    Write-Host "Found AI routes in:" -ForegroundColor Green
    foreach ($route in $aiRoutes) {
        Write-Host "  📄 $($route.Filename)" -ForegroundColor White
        Write-Host "     $($route.Line.Trim())" -ForegroundColor Gray
    }
} else {
    Write-Host "No AI routes found in common locations." -ForegroundColor Yellow
    Write-Host "Check your main router (likely src/index.js) for route definitions." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Analysis complete!" -ForegroundColor Green
Write-Host "Use the report file for detailed results." -ForegroundColor Gray
