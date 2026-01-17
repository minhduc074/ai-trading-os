# Test AI Trader Integration with CLIProxyAPI
# This script tests that the AI Trader can communicate with CLIProxyAPI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing AI Trader Integration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$cliproxyUrl = "http://localhost:8317"
$apiKey = "sk-cliproxy-demo-key-12345"

# Check if CLIProxyAPI is running
Write-Host "1. Checking CLIProxyAPI server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$cliproxyUrl/" -Method Get -UseBasicParsing
    Write-Host "   CLIProxyAPI is running!" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: CLIProxyAPI is not running!" -ForegroundColor Red
    Write-Host "   Please start it: cd G:\AI\CLIProxyAPI; .\start-server.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check available models
Write-Host "2. Checking available models..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $apiKey"
    }
    $models = Invoke-RestMethod -Uri "$cliproxyUrl/v1/models" -Method Get -Headers $headers
    
    $claudeModels = $models.data | Where-Object { $_.id -like "*claude*" }
    
    if ($claudeModels.Count -gt 0) {
        Write-Host "   Found $($claudeModels.Count) Claude models:" -ForegroundColor Green
        foreach ($model in $claudeModels) {
            Write-Host "     - $($model.id)" -ForegroundColor White
        }
    } else {
        Write-Host "   WARNING: No Claude models found!" -ForegroundColor Yellow
        Write-Host "   Make sure you logged into Antigravity" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ERROR: Failed to get models" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Test trading decision format
Write-Host "3. Testing trading decision..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    }
    
    $body = @{
        model = "gemini-claude-sonnet-4-5"
        messages = @(
            @{
                role = "system"
                content = "You are a crypto trading AI. Output ONLY valid JSON. No explanations."
            }
            @{
                role = "user"
                content = "Analyze this: BTC is at $95,000 with RSI 65. Output trading decision in JSON format with fields: action, reasoning, confidence."
            }
        )
        temperature = 0.1
        max_tokens = 300
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$cliproxyUrl/v1/chat/completions" -Method Post -Headers $headers -Body $body
    
    Write-Host "   Trading decision test successful!" -ForegroundColor Green
    Write-Host "   Model used: gemini-claude-sonnet-4-5" -ForegroundColor Gray
    Write-Host "   Response preview:" -ForegroundColor Gray
    Write-Host "   $($response.choices[0].message.content.Substring(0, [Math]::Min(200, $response.choices[0].message.content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ERROR: Failed to get trading decision" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Integration test PASSED!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Keep CLIProxyAPI running" -ForegroundColor White
Write-Host "2. Start AI Trader: cd G:\AI\test_ai\ai_trader; npm run dev" -ForegroundColor White
Write-Host "3. Open http://localhost:3000" -ForegroundColor White
Write-Host "4. Click 'Get AI Decision' to see Claude in action!" -ForegroundColor White
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Model: gemini-claude-sonnet-4-5" -ForegroundColor White
Write-Host "  API: http://localhost:8317/v1" -ForegroundColor White
Write-Host "  Provider: Antigravity (FREE via Google OAuth)" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
