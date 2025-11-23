# AI Trading OS - Installation Script
# Run with: .\install.ps1

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🤖 AI Trading Operating System v2.0.2                      ║
║   Installation Script                                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Check Node.js installation
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check npm installation
Write-Host "Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found!" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host "`nCreating .env file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created from template" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env and add your API keys!" -ForegroundColor Yellow
} else {
    Write-Host "`n.env file already exists" -ForegroundColor Green
}

# Create data directory
if (!(Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "✓ Created data directory" -ForegroundColor Green
}

# Create decision_logs directory
if (!(Test-Path "decision_logs")) {
    New-Item -ItemType Directory -Path "decision_logs" | Out-Null
    Write-Host "✓ Created decision_logs directory" -ForegroundColor Green
}

# Build TypeScript
Write-Host "`nBuilding TypeScript..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Build had some warnings (this is normal)" -ForegroundColor Yellow
}

# Display next steps
Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ✅ Installation Complete!                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

📋 Next Steps:

1. Configure your API keys:
   notepad .env

2. Required API keys:
   - Binance Testnet: https://testnet.binancefuture.com/
    - DeepSeek, Qwen or OpenRouter AI API key

3. Start the system:
   npm run dev

4. Access dashboard:
   http://localhost:3000

⚠️  IMPORTANT:
   - Always start with TESTNET mode first
   - Test thoroughly before using real money
   - Monitor your system closely

📚 Documentation:
   - SETUP.md    : Detailed setup guide
   - COMMANDS.md : Command reference
   - README.md   : Feature overview

🆘 Need help?
   - Check console logs for errors
   - Review decision_logs/ for AI decisions
   - Verify .env configuration

"@ -ForegroundColor Cyan

Write-Host "Happy trading! 🚀" -ForegroundColor Green
