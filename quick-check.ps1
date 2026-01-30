Write-Host ""
Write-Host " Pre-Push Security Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env files are staged
Write-Host "Checking for sensitive files..." -ForegroundColor Yellow
$staged = git diff --cached --name-only

if ($staged -match '\.env|\.pem|\.key') {
    Write-Host " DANGER: Sensitive files are staged!" -ForegroundColor Red
} else {
    Write-Host " No sensitive files staged" -ForegroundColor Green
}

# Check if .env is ignored
Write-Host ""
Write-Host "Checking .gitignore..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $check = git check-ignore .env 2>$null
    if ($check) {
        Write-Host " .env is properly ignored" -ForegroundColor Green
    } else {
        Write-Host " .env is NOT ignored!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "  REMEMBER:" -ForegroundColor Yellow
Write-Host "- Sensitive files are still in Git history" -ForegroundColor White
Write-Host "- See GIT_SECURITY_SUMMARY.md for cleanup instructions" -ForegroundColor White
Write-Host ""
