# PowerShell script to add status filtering to Workers.js, Services.js, Ads.js, and Favorites.js

Write-Host "Adding status filters to all pages..." -ForegroundColor Green

# 1. Workers.js - Add status filter after line 472
$workersFile = "src\pages\Workers.js"
$workersContent = Get-Content $workersFile -Raw
$workersContent = $workersContent -replace '(    // Second, Filter\r?\n    const filtered = withDistance\.filter\(worker => \{\r?\n)(      // Search)', '$1      // Status filter - only show active posts$2      if (worker.status && worker.status !== "active") return false;$2$2'
Set-Content -Path $workersFile -Value $workersContent -NoNewline
Write-Host "✓ Workers.js updated" -ForegroundColor Cyan

# 2. Services.js - Replace line 710
$servicesFile = "src\pages\Services.js"
$servicesContent = Get-Content $servicesFile -Raw
$servicesContent = $servicesContent -replace 'if \(service\.status === "expired"\) return false;', '// Filter out expired and disabled posts$1      if (service.status && service.status !== "active") return false;'
Set-Content -Path $servicesFile -Value $servicesContent -NoNewline
Write-Host "✓ Services.js updated" -ForegroundColor Cyan

# 3. Ads.js - Add status filter
$adsFile = "src\pages\Ads.js"
if (Test-Path $adsFile) {
    $adsContent = Get-Content $adsFile -Raw
    # Find the filter section and add status check
    $adsContent = $adsContent -replace '(const filtered[^=]*=.*?\.filter\([^=]+ => \{\r?\n)', '$1      // Status filter - only show active posts$1      if (ad.status && ad.status !== "active") return false;$1$1'
    Set-Content -Path $adsFile -Value $adsContent -NoNewline
    Write-Host "✓ Ads.js updated" -ForegroundColor Cyan
}

# 4. Favorites.js - Add status filter
$favoritesFile = "src\pages\Favorites.js"
if (Test-Path $favoritesFile) {
    $favoritesContent = Get-Content $favoritesFile -Raw
    # Add status filter for each type (workers, services, ads)
    $favoritesContent = $favoritesContent -replace '(\.filter\([^=]+ => \{\r?\n)', '$1      // Status filter - only show active posts$1      if (item.status && item.status !== "active") return false;$1$1'
    Set-Content -Path $favoritesFile -Value $favoritesContent -NoNewline
    Write-Host "✓ Favorites.js updated" -ForegroundColor Cyan
}

Write-Host "`nAll files updated successfully!" -ForegroundColor Green
Write-Host "Please check the files and test the changes." -ForegroundColor Yellow
