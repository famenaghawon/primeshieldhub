# Bing Image Creator Automation
# Generates images by opening Bing Create URLs automatically
# 100 free images per day

$csvFile = "image-prompts.csv"
$outputDir = "assets\products"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Read CSV
$products = Import-Csv $csvFile

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "BING IMAGE CREATOR - BATCH URL GENERATOR" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will open Bing Image Creator in your browser"
Write-Host "for each product. You'll need to click 'Create' for each one."
Write-Host ""
Write-Host "Total products: $($products.Count)"
Write-Host "NOTE: Bing allows 100 generations per day for free"
Write-Host ""

$continue = Read-Host "Press Enter to start generating URLs (or Ctrl+C to cancel)"

# Create a master HTML file with all prompts
$htmlContent = @"
<!DOCTYPE html>
<html>
<head>
    <title>PrimeShieldHub - Image Generation Queue</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .header { background: #1a1a2e; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .product { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4CAF50; display: flex; align-items: center; gap: 15px; }
        .product.done { border-left-color: #2196F3; opacity: 0.7; }
        .product-info { flex: 1; }
        .product-name { font-weight: bold; color: #333; margin-bottom: 5px; }
        .product-filename { color: #666; font-size: 14px; }
        .product-category { color: #999; font-size: 12px; }
        .btn { padding: 10px 20px; border-radius: 5px; text-decoration: none; color: white; font-weight: bold; display: inline-block; cursor: pointer; border: none; }
        .btn-generate { background: #4CAF50; }
        .btn-generate:hover { background: #45a049; }
        .counter { text-align: center; font-size: 24px; margin: 20px 0; color: #1a1a2e; }
        .progress { background: #e0e0e0; border-radius: 10px; height: 30px; margin: 10px 0; }
        .progress-bar { background: #4CAF50; height: 100%; border-radius: 10px; text-align: center; color: white; line-height: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PrimeShieldHub BuildMart</h1>
        <p>Product Image Generation Queue - Bing Image Creator</p>
        <p>Total: $($products.Count) products | Daily limit: 100 | Estimated days: $([Math]::Ceiling($products.Count / 100))</p>
    </div>
    <div class="counter">
        <span id="done-count">0</span> / $($products.Count) completed
    </div>
    <div class="progress">
        <div class="progress-bar" id="progress-bar" style="width: 0%">0%</div>
    </div>
    <div id="product-list">
"@

$index = 0
foreach ($product in $products) {
    $index++
    # Create Bing Image Creator URL with prompt
    $prompt = [System.Web.HttpUtility]::UrlEncode($product.prompt)
    $bingUrl = "https://www.bing.com/images/create?q=$prompt"
    
    $htmlContent += @"
        <div class="product" id="product-$index">
            <div class="product-info">
                <div class="product-name">#$index - $($product.product_name)</div>
                <div class="product-filename">📁 $($product.filename)</div>
                <div class="product-category">🏷️ $($product.category)</div>
            </div>
            <a href="$bingUrl" target="_blank" class="btn btn-generate" onclick="markDone($index)">🎨 Generate</a>
        </div>
"@
}

$htmlContent += @"
    </div>
    <script>
        let doneCount = 0;
        const total = $($products.Count);
        
        function markDone(index) {
            const product = document.getElementById('product-' + index);
            if (product && !product.classList.contains('done')) {
                product.classList.add('done');
                doneCount++;
                document.getElementById('done-count').textContent = doneCount;
                const percent = Math.round((doneCount / total) * 100);
                document.getElementById('progress-bar').style.width = percent + '%';
                document.getElementById('progress-bar').textContent = percent + '%';
            }
        }
        
        // Load saved progress
        const saved = localStorage.getItem('psh-progress');
        if (saved) {
            const doneList = JSON.parse(saved);
            doneList.forEach(index => markDone(index));
        }
        
        // Save progress
        window.addEventListener('beforeunload', () => {
            const doneItems = [];
            document.querySelectorAll('.product.done').forEach(el => {
                doneItems.push(parseInt(el.id.replace('product-', '')));
            });
            localStorage.setItem('psh-progress', JSON.stringify(doneItems));
        });
    </script>
</body>
</html>
"@

# Save the HTML file
$htmlFile = "generate-queue.html"
$htmlContent | Out-File -FilePath $htmlFile -Encoding UTF8

Write-Host ""
Write-Host "✅ HTML queue file created: $htmlFile" -ForegroundColor Green
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. Open $htmlFile in your browser" -ForegroundColor White
Write-Host "2. Click 'Generate' for each product - it opens Bing Image Creator" -ForegroundColor White
Write-Host "3. Click 'Create' on the Bing page to generate the image" -ForegroundColor White
Write-Host "4. Download the generated image" -ForegroundColor White
Write-Host "5. Rename it to match the filename shown" -ForegroundColor White
Write-Host "6. Save to: $outputDir\" -ForegroundColor White
Write-Host ""
Write-Host "BING DAILY LIMIT: 100 images per 24 hours" -ForegroundColor Cyan

# Open the HTML file
Start-Process $htmlFile
