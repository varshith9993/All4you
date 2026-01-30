# Pre-Push Security Verification Script
# Run this before pushing to Git to ensure no sensitive data is included

Write-Host "`n🔍 Pre-Push Security Verification" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

$allClear = $true

# Check 1: Verify sensitive files are not staged
Write-Host "Check 1: Verifying sensitive files are not staged..." -ForegroundColor Yellow
$stagedFiles = git diff --cached --name-only

if ($stagedFiles -match '\.env$|\.pem$|\.key$|serviceAccount.*\.json$') {
    Write-Host "  ✗ DANGER: Sensitive files are staged!" -ForegroundColor Red
    $allClear = $false
} else {
    Write-Host "  ✓ No sensitive files staged" -ForegroundColor Green
}

# Check 2: Verify .gitignore exists
Write-Host "`nCheck 2: Verifying .gitignore..." -ForegroundColor Yellow
if (Test-Path ".gitignore") {
    Write-Host "  ✓ .gitignore exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ .gitignore does not exist!" -ForegroundColor Red
    $allClear = $false
}

# Check 3: Verify .env files are ignored
Write-Host "`nCheck 3: Verifying .env files are properly ignored..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $check = git check-ignore .env 2>$null
    if ($check) {
        Write-Host "  ✓ .env is ignored" -ForegroundColor Green
    } else {
        Write-Host "  ✗ .env is NOT ignored!" -ForegroundColor Red
        $allClear = $false
    }
}

if (Test-Path "functions/.env") {
    $check = git check-ignore functions/.env 2>$null
    if ($check) {
        Write-Host "  ✓ functions/.env is ignored" -ForegroundColor Green
    } else {
        Write-Host "  ✗ functions/.env is NOT ignored!" -ForegroundColor Red
        $allClear = $false
    }
}

# Check 4: Verify .env.example files exist
Write-Host "`nCheck 4: Verifying .env.example files..." -ForegroundColor Yellow
if (Test-Path ".env.example") {
    Write-Host "  ✓ .env.example exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠ .env.example does not exist" -ForegroundColor Yellow
}

if (Test-Path "functions/.env.example") {
    Write-Host "  ✓ functions/.env.example exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠ functions/.env.example does not exist" -ForegroundColor Yellow
}

# Check 5: List what will be pushed
Write-Host "`nCheck 5: Commits that will be pushed:" -ForegroundColor Yellow
$unpushedCommits = git log origin/main..HEAD --oneline 2>$null
if ($unpushedCommits) {
    $unpushedCommits | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} else {
    Write-Host "  No new commits to push" -ForegroundColor Gray
}

# Final verdict
Write-Host "`n================================" -ForegroundColor Cyan
if ($allClear) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host "`nYour repository is secure and ready to push." -ForegroundColor White
} else {
    Write-Host "❌ SECURITY ISSUES DETECTED!" -ForegroundColor Red
    Write-Host "`nPlease fix the issues above before pushing." -ForegroundColor Yellow
    Write-Host "DO NOT push until all checks pass!" -ForegroundColor Red
}
Write-Host "================================`n" -ForegroundColor Cyan

# Important reminders
Write-Host "⚠️  IMPORTANT REMINDERS:" -ForegroundColor Yellow
Write-Host "1. Sensitive files are still in Git HISTORY" -ForegroundColor White
Write-Host "2. You should clean Git history before pushing" -ForegroundColor White
Write-Host "3. Rotate all credentials that were previously committed" -ForegroundColor White
Write-Host "`nSee GIT_SECURITY_SUMMARY.md for detailed instructions.`n" -ForegroundColor Gray
