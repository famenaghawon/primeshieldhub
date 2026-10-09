# remove-defaults.ps1
$files = @("admin.js", "branch.js", "charging.js", "admin-auth.js")

foreach ($file in $files) {
    $path = "C:\Users\myori\Desktop\primeshieldhub\backend\src\handlers\$file"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        # Remove export default { ... } blocks (including nested braces)
        $content = $content -replace '(?s)export\s+default\s*\{[^{}]*\{[^{}]*\}[^{}]*\}|export\s+default\s*\{[^}]*\}', ''
        Set-Content $path $content -NoNewline
        Write-Host "Fixed: $file"
    }
}

Write-Host "Done!"
