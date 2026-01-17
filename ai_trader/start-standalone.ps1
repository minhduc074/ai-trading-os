# =============================================================================
# AI Trader - Start Standalone Background Service
# =============================================================================
# This script starts the AI trader as a standalone background service
# No web browser or UI required - pure command line trading bot
# =============================================================================

param(
    [switch]$Help,
    [switch]$Simulation,
    [int]$IntervalMinutes = 0
)

if ($Help) {
    Write-Host ""
    Write-Host "AI Trader - Standalone Background Service" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\start-standalone.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Help              Show this help message"
    Write-Host "  -Simulation        Force simulation mode (no real trades)"
    Write-Host "  -IntervalMinutes   Set decision interval in minutes (default: 15)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\start-standalone.ps1                    # Normal start"
    Write-Host "  .\start-standalone.ps1 -Simulation        # Simulation mode"
    Write-Host "  .\start-standalone.ps1 -IntervalMinutes 5 # 5-minute intervals"
    Write-Host ""
    exit 0
}

# Clear screen for clean output
Clear-Host

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                              ║" -ForegroundColor Cyan
Write-Host "║     🤖 AI TRADER - STANDALONE BACKGROUND SERVICE 🤖         ║" -ForegroundColor Cyan
Write-Host "║                                                              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    Write-Host "   ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    Write-Host "   Download: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "   ⚠️  No .env.local found - creating from example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env.local"
        Write-Host "   📝 Please edit .env.local with your API keys" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ No .env.example found. Please create .env.local manually." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ Configuration: .env.local" -ForegroundColor Green
}

# Check if dotenv is available
if (-not (Test-Path "node_modules/dotenv")) {
    Write-Host ""
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install dotenv --save
}

# Set environment variables based on parameters
$env:NODE_ENV = "production"

if ($Simulation) {
    $env:SIMULATION_MODE = "true"
    Write-Host "   🎮 Mode: SIMULATION (forced)" -ForegroundColor Yellow
}

if ($IntervalMinutes -gt 0) {
    $env:DECISION_INTERVAL_MS = ($IntervalMinutes * 60 * 1000).ToString()
    Write-Host "   ⏱️  Interval: $IntervalMinutes minutes (override)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "🚀 Starting AI Trader Background Service..." -ForegroundColor Green
Write-Host "📌 No web browser needed - this runs in the terminal only" -ForegroundColor White
Write-Host "⛔ Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# Start the standalone service
try {
    node standalone/index.js
} catch {
    Write-Host ""
    Write-Host "❌ Error starting the service:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
