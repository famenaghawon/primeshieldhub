# upload-icons.ps1
# Run from: C:\Users\myori\Desktop\primeshieldhub\frontend

Write-Host "📤 Uploading Main Site Icons..." -ForegroundColor Cyan

# Main icons
npx wrangler r2 object put primeshieldhub-storage/icons/icon-48x48.png --remote --file=public/icons/icon-48x48.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-72x72.png --remote --file=public/icons/icon-72x72.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-96x96.png --remote --file=public/icons/icon-96x96.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-128x128.png --remote --file=public/icons/icon-128x128.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-144x144.png --remote --file=public/icons/icon-144x144.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-152x152.png --remote --file=public/icons/icon-152x152.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-192x192.png --remote --file=public/icons/icon-192x192.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-256x256.png --remote --file=public/icons/icon-256x256.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-384x384.png --remote --file=public/icons/icon-384x384.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-512x512.png --remote --file=public/icons/icon-512x512.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-maskable-192.png --remote --file=public/icons/icon-maskable-192.png
npx wrangler r2 object put primeshieldhub-storage/icons/icon-maskable-512.png --remote --file=public/icons/icon-maskable-512.png

Write-Host "✅ Main Site Icons uploaded!" -ForegroundColor Green
Write-Host ""

Write-Host "📤 Uploading Main Site Shortcuts..." -ForegroundColor Cyan
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/marketplace-96.png --remote --file=public/icons/shortcuts/marketplace-96.png
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/reseller-96.png --remote --file=public/icons/shortcuts/reseller-96.png
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/ai-96.png --remote --file=public/icons/shortcuts/ai-96.png
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/track-96.png --remote --file=public/icons/shortcuts/track-96.png
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/enterprise-96.png --remote --file=public/icons/shortcuts/enterprise-96.png
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/founder-96.png --remote --file=public/icons/shortcuts/founder-96.png
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/staff-96.png --remote --file=public/icons/shortcuts/staff-96.png
npx wrangler r2 object put primeshieldhub-storage/icons/shortcuts/staff-dashboard-96.png --remote --file=public/icons/shortcuts/staff-dashboard-96.png

Write-Host "✅ Main Site Shortcuts uploaded!" -ForegroundColor Green
Write-Host ""

Write-Host "📤 Uploading Staff Portal Icons..." -ForegroundColor Cyan
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-48x48.png --remote --file=public/staff-icons/icon-48x48.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-72x72.png --remote --file=public/staff-icons/icon-72x72.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-96x96.png --remote --file=public/staff-icons/icon-96x96.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-128x128.png --remote --file=public/staff-icons/icon-128x128.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-144x144.png --remote --file=public/staff-icons/icon-144x144.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-152x152.png --remote --file=public/staff-icons/icon-152x152.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-192x192.png --remote --file=public/staff-icons/icon-192x192.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-256x256.png --remote --file=public/staff-icons/icon-256x256.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-384x384.png --remote --file=public/staff-icons/icon-384x384.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-512x512.png --remote --file=public/staff-icons/icon-512x512.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-maskable-192.png --remote --file=public/staff-icons/icon-maskable-192.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/icon-maskable-512.png --remote --file=public/staff-icons/icon-maskable-512.png

Write-Host "✅ Staff Portal Icons uploaded!" -ForegroundColor Green
Write-Host ""

Write-Host "📤 Uploading Staff Portal Shortcuts..." -ForegroundColor Cyan
npx wrangler r2 object put primeshieldhub-storage/staff-icons/shortcut-dashboard.png --remote --file=public/staff-icons/shortcut-dashboard.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/shortcut-profile.png --remote --file=public/staff-icons/shortcut-profile.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/shortcut-settings.png --remote --file=public/staff-icons/shortcut-settings.png
npx wrangler r2 object put primeshieldhub-storage/staff-icons/shortcut-activity.png --remote --file=public/staff-icons/shortcut-activity.png

Write-Host "✅ Staff Portal Shortcuts uploaded!" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 ALL ICONS UPLOADED SUCCESSFULLY!" -ForegroundColor Yellow
