$rootFolder = "C:\Users\myori\Desktop\primeshieldhub\frontend\public"
$extensions = "*.html", "*.js", "*.css", "*.json"
$totalFixes = 0
$files = Get-ChildItem -Path $rootFolder -Include $extensions -Recurse -File

$replacements = @{
    'Ã¢â€šÂ¦' = '₦'
    'Ã‚Â·'   = '·'
    'Ã¢Â€Â™' = "'"
    'Ã¢Â€Âœ' = '"'
    'Ã¢Â€Â'  = '"'
    'Ã¢Â€Â"' = '—'
    'Ã¢Â€Â¦' = '…'
    'Ã¢Â€Âº' = '›'
    'Ã¢â€”Â' = '•'
    'Ã¢Âœâ€¦' = '✓'
    'Ã¯Â¿Â½'  = '-'
    'Âfâ€šÃ„Ã´' = '⚡'
    'Ã°Å¸â€Â'  = '🚀'
    'Ã°Å¸â€Â¥' = '🔥'
    'Ã¢ÂœÂ…' = '✅'
}

foreach ($file in $files) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $originalContent = $content

        foreach ($find in $replacements.Keys) {
            if ($content.Contains($find)) {
                $content = $content.Replace($find, $replacements[$find])
            }
        }

        if ($content -ne $originalContent) {
            [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "FIXED: $($file.FullName)" -ForegroundColor Green
            $totalFixes++
        }
    } catch {
        Write-Host "SKIPPED (error): $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Total files fixed: $totalFixes" -ForegroundColor Cyan
