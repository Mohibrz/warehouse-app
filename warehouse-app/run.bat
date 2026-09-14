@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed. Please install Python first.
    pause
    exit /b 1
)

REM Check if venv exists
if not exist venv\Scripts\activate.bat (
    echo Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo Error: Failed to create virtual environment.
        pause
        exit /b 1
    )
)

REM Activate venv
echo Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo Error: Failed to activate virtual environment.
    pause
    exit /b 1
)

REM Upgrade pip and install requirements
echo Upgrading pip and installing requirements...
python -m pip install --upgrade pip --quiet
python -m pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo Error: Failed to install requirements. Make sure requirements.txt exists.
    pause
    exit /b 1
)

REM Check if Tailscale is installed and running
where tailscale >nul 2>&1
if %errorlevel% == 0 (
    tailscale status >nul 2>&1
    if %errorlevel% == 0 (
        echo Tailscale: Connected
        echo Note: For Tailscale access, run 'tailscale serve https://9000' in a separate window
    ) else (
        echo Tailscale: Not connected - Start Tailscale first
    )
) else (
    echo Tailscale: Not installed - Skipping Tailscale check
)

echo.
echo ===================================
echo Access Links
echo ===================================
echo Local:       http://localhost:9000
echo API Docs:    http://localhost:9000/docs
echo.
echo User: admin
echo Password: admin123
echo.
echo Press Ctrl+C to stop
echo ===================================
echo.

REM Start the server using venv python
echo Starting server...
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
pause
