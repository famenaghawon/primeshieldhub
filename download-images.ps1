$OldDeploymentUrl = "https://b4a29cae.primeshieldhub-v2.pages.dev"
$apiUrl = "https://api.primeshieldhub.com/api/products?limit=5000"

Write-Host "Fetching product list..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri $apiUrl -Method GET
$products = $response.products
$imagesToDownload = $products | Where-Object { $_.image -like "/assets/products/*" -or $_.image_url -like "/assets/products/*" }
$total = $imagesToDownload.Count

Write-Host "Attempting to download $total images from $OldDeploymentUrl" -ForegroundColor Green

$count = 0
$failed = 0
foreach ($p in $imagesToDownload) {
    $imagePath = if ($p.image) { $p.image } else { $p.image_url }
    $fileName = Split-Path $imagePath -Leaf
    $localPath = "frontend\public\assets\products\$fileName"
    
    $url = "$OldDeploymentUrl$imagePath"
    
    if (-not (Test-Path $localPath)) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $localPath -ErrorAction Stop
            $count++
            if ($count % 50 -eq 0) {
                Write-Host "Downloaded $count / $total images..." -ForegroundColor Gray
            }
        } catch {
            $failed++
        }
    } else {
        $count++
    }
}
Write-Host "✅ Download complete! Successfully downloaded: $count | Failed: $failed" -ForegroundColor Green
