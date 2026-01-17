# Start Background Trader
# This runs the AI trader independently without needing a browser

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Trader Background Service" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Next.js API is running
Write-Host "Checking if Next.js API is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3
    Write-Host "   API is running!" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: Next.js API is not running!" -ForegroundColor Red
    Write-Host "   Please start it first: npm run dev" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Starting background trader..." -ForegroundColor Cyan
Write-Host "This will run continuously (no browser needed)" -ForegroundColor White
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start the background trader
node background-trader.js
