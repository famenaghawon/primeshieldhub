# test-approve.ps1
Write-Host "=== Testing Staff Approve ===" -ForegroundColor Cyan

# 1. Login
$loginBody = @{
    email = "f.e.amenaghawon@gmail.com"
    password = "1234And56789$Admin"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "https://api.primeshieldhub.com/api/auth/admin-login" -Method Post -Headers @{"Content-Type"="application/json"} -Body $loginBody
$token = $loginResponse.token
Write-Host "✅ Got token: $token" -ForegroundColor Green

# 2. Test admin check
try {
    $check = Invoke-RestMethod -Uri "https://api.primeshieldhub.com/api/auth/admin-check" -Method Get -Headers @{"Authorization"="Bearer $token"}
    Write-Host "✅ Admin check passed: $($check.user.email) (Role: $($check.user.role))" -ForegroundColor Green
} catch {
    Write-Host "❌ Admin check failed: $_" -ForegroundColor Red
}

# 3. Get pending staff
$pendingStaff = npx wrangler d1 execute primeshieldhub-db --remote --command="SELECT id, name, email FROM staff WHERE status='pending';"
Write-Host "`n📋 Pending staff:" -ForegroundColor Yellow
Write-Host $pendingStaff

# 4. If there's a pending staff, test approve
$staffId = Read-Host "`nEnter Staff ID to approve (or press Enter to skip)"
if ($staffId) {
    $body = @{staffId = $staffId} | ConvertTo-Json
    try {
        $result = Invoke-RestMethod -Uri "https://api.primeshieldhub.com/api/staff/$staffId/approve" -Method Post -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} -Body $body
        Write-Host "✅ Approve successful: $($result.message)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Approve failed: $_" -ForegroundColor Red
        # Show the response body
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $reader.BaseStream.Position = 0
            $reader.DiscardBufferedData()
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response body: $responseBody" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n✅ Done!" -ForegroundColor Cyan
