# ============================================
# Git Security Cleanup Script
# ============================================
# This script removes sensitive files from Git tracking
# and prevents them from being committed in the future

Write-Host "🔒 Git Security Cleanup Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Step 1: Remove sensitive files from Git index (but keep local files)
Write-Host "Step 1: Removing sensitive files from Git tracking..." -ForegroundColor Yellow

$sensitiveFiles = @(
    ".env",
    "localhost-2.pem",
    "localhost-2-key.pem",
    "functions/.env"
)

foreach ($file in $sensitiveFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ Untracking: $file" -ForegroundColor Green
        git rm --cached $file 2>$null
    } else {
        Write-Host "  ℹ File not found: $file" -ForegroundColor Gray
    }
}

# Step 2: Verify .gitignore is in place
Write-Host "`nStep 2: Verifying .gitignore..." -ForegroundColor Yellow
if (Test-Path ".gitignore") {
    Write-Host "  ✓ .gitignore exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ .gitignore not found!" -ForegroundColor Red
    exit 1
}

# Step 3: Check current status
Write-Host "`nStep 3: Current Git status:" -ForegroundColor Yellow
git status --short

# Step 4: Instructions
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANT NEXT STEPS" -ForegroundColor Yellow
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "The sensitive files have been removed from Git tracking." -ForegroundColor White
Write-Host "However, they still exist in Git HISTORY.`n" -ForegroundColor White

Write-Host "To completely remove them from history, you have two options:`n" -ForegroundColor White

Write-Host "OPTION 1 - Simple (Recommended for new repos):" -ForegroundColor Cyan
Write-Host "  If this repo hasn't been shared with others yet:" -ForegroundColor Gray
Write-Host "  1. Delete the .git folder" -ForegroundColor White
Write-Host "  2. Run: git init" -ForegroundColor White
Write-Host "  3. Run: git add ." -ForegroundColor White
Write-Host "  4. Run: git commit -m 'Initial commit with security fixes'" -ForegroundColor White
Write-Host "  5. Add your remote and force push`n" -ForegroundColor White

Write-Host "OPTION 2 - Advanced (For shared repos):" -ForegroundColor Cyan
Write-Host "  Use git filter-branch to rewrite history:" -ForegroundColor Gray
Write-Host "  git filter-branch --force --index-filter \" -ForegroundColor White
Write-Host "    'git rm --cached --ignore-unmatch .env localhost-2.pem localhost-2-key.pem' \" -ForegroundColor White
Write-Host "    --prune-empty --tag-name-filter cat -- --all" -ForegroundColor White
Write-Host "  git push origin --force --all`n" -ForegroundColor White

Write-Host "⚠️  SECURITY WARNING:" -ForegroundColor Red
Write-Host "  Since these files were in Git, you should:" -ForegroundColor Yellow
Write-Host "  1. Rotate all API keys and credentials" -ForegroundColor White
Write-Host "  2. Generate new SSL certificates" -ForegroundColor White
Write-Host "  3. Update your .env files with new credentials`n" -ForegroundColor White

Write-Host "============================================`n" -ForegroundColor Cyan

# Ask user what they want to do
Write-Host "What would you like to do?" -ForegroundColor Yellow
Write-Host "1. Commit the changes (removes files from tracking)" -ForegroundColor White
Write-Host "2. Exit and decide later" -ForegroundColor White
$choice = Read-Host "`nEnter your choice (1 or 2)"

if ($choice -eq "1") {
    Write-Host "`nCommitting changes..." -ForegroundColor Yellow
    git add .gitignore .env.example functions/.env.example SECURITY.md
    git commit -m "🔒 Security: Remove sensitive files and add comprehensive .gitignore

- Remove .env files from Git tracking
- Remove SSL certificates (.pem files) from tracking
- Add comprehensive .gitignore for all sensitive files
- Add .env.example files for documentation
- Add SECURITY.md with setup instructions

⚠️ Note: Files removed from tracking but still in history.
Credentials should be rotated as a precaution."
    
    Write-Host "`n✓ Changes committed!" -ForegroundColor Green
    Write-Host "`nNext: Choose Option 1 or 2 above to clean Git history." -ForegroundColor Yellow
} else {
    Write-Host "`nNo changes committed. You can commit manually later." -ForegroundColor Gray
}

Write-Host "`n✓ Script complete!" -ForegroundColor Green
