@echo off
REM =============================================================================
REM AI Trader - Start Standalone Background Service (Windows Batch)
REM =============================================================================
REM Just double-click this file to start the trader!
REM =============================================================================

title AI Trader - Standalone Background Service

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║     🤖 AI TRADER - STANDALONE BACKGROUND SERVICE 🤖         ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js not found. Please install Node.js first.
    echo    Download: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found
echo.
echo 🚀 Starting AI Trader...
echo 📌 No web browser needed - runs in terminal only
echo ⛔ Press Ctrl+C to stop
echo.

cd /d "%~dp0"
node standalone/index.js

pause
