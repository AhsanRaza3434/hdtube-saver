@echo off
setlocal enabledelayedexpansion

echo Checking for Administrator privileges...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Please right-click on the script and select "Run as Administrator"
    pause
    exit /b 1
)

echo Creating log directory...
if not exist "logs" mkdir logs

echo Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install Node.js dependencies
    echo Check logs\npm-install.log for details
    pause
    exit /b 1
)

echo Installing required packages...
call npm install node-windows is-admin --save
if errorlevel 1 (
    echo ERROR: Failed to install required packages
    echo Check logs\package-install.log for details
    pause
    exit /b 1
)

REM Check for yt-dlp and ffmpeg
echo Checking for required external tools...
set MISSING_TOOLS=0

where yt-dlp >nul 2>nul
if errorlevel 1 (
    echo WARNING: yt-dlp not found. Please install yt-dlp for Windows and add it to PATH.
    echo Download from: https://github.com/yt-dlp/yt-dlp/releases/latest
    set /a MISSING_TOOLS+=1
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo WARNING: ffmpeg not found. Please install ffmpeg for Windows and add it to PATH.
    echo Download from: https://ffmpeg.org/download.html
    set /a MISSING_TOOLS+=1
)

if !MISSING_TOOLS! gtr 0 (
    echo.
    echo WARNING: Some required tools are missing. The service may not function correctly.
    echo Do you want to continue anyway? (Y/N)
    set /p CONTINUE=
    if /i "!CONTINUE!" neq "Y" exit /b 1
)

echo.
echo Installing Windows Service...
node install-service.js > logs\service-install.log 2>&1
if errorlevel 1 (
    echo ERROR: Failed to install Windows Service
    echo Check logs\service-install.log for details
    pause
    exit /b 1
)

echo.
echo Checking service status...
timeout /t 5 /nobreak >nul
sc query "HDTube-Saver" | find "RUNNING" >nul
if errorlevel 1 (
    echo WARNING: Service is not running. Checking service status...
    sc query "HDTube-Saver"
    echo.
    echo Please check Windows Services (services.msc) for details
    echo Also check logs\service-install.log for installation details
) else (
    echo Service is running successfully!
)

echo.
echo Installation completed. The service will start automatically when the server restarts.
echo.
echo To manage the service:
echo 1. Open Windows Services (services.msc)
echo 2. Look for "HDTube-Saver"
echo 3. Right-click to start, stop, or restart the service
echo.
echo Press any key to exit...
pause >nul 