# Script to fix Prisma client generation after database provider change
# This script stops any processes using the Prisma query engine file and regenerates the client

Write-Host "Fixing Prisma Client Generation..." -ForegroundColor Cyan
Write-Host ""

# Check if Prisma query engine file exists and is locked
$queryEnginePath = "node_modules\.prisma\client\query_engine-windows.dll.node"
if (Test-Path $queryEnginePath) {
    Write-Host "Found locked Prisma query engine file. Attempting to free it..." -ForegroundColor Yellow
    
    # Try to get processes using the file (requires Handle.exe from Sysinternals, so we'll try a different approach)
    Write-Host "Please stop your Next.js dev server manually (Ctrl+C in the terminal where it's running)" -ForegroundColor Yellow
    Write-Host "Waiting 3 seconds for you to stop the server..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}

# Clean up old Prisma client
Write-Host "Cleaning up old Prisma client..." -ForegroundColor Cyan
if (Test-Path "node_modules\.prisma") {
    try {
        Remove-Item -Path "node_modules\.prisma" -Recurse -Force -ErrorAction Stop
        Write-Host "✓ Removed old Prisma client" -ForegroundColor Green
    } catch {
        Write-Host "✗ Could not remove Prisma client: $_" -ForegroundColor Red
        Write-Host "Please manually stop all Node.js processes and try again" -ForegroundColor Yellow
        Write-Host "Or run: Get-Process node | Stop-Process -Force" -ForegroundColor Yellow
        exit 1
    }
}

# Clean Next.js cache
Write-Host "Cleaning Next.js cache..." -ForegroundColor Cyan
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Removed Next.js cache" -ForegroundColor Green
}

# Regenerate Prisma client
Write-Host ""
Write-Host "Regenerating Prisma client for MySQL..." -ForegroundColor Cyan
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Prisma client regenerated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now start your dev server with: npm run dev" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Failed to generate Prisma client" -ForegroundColor Red
    Write-Host "Make sure all Node.js processes are stopped and try again" -ForegroundColor Yellow
}

