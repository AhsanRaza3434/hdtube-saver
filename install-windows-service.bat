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

REM Check for Node.js
echo Checking for Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check for npm
echo Checking for npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check for yt-dlp
echo Checking for yt-dlp...
where yt-dlp >nul 2>&1
if errorlevel 1 (
    echo WARNING: yt-dlp not found
    echo Installing yt-dlp...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'yt-dlp.exe'"
    if errorlevel 1 (
        echo ERROR: Failed to download yt-dlp
        echo Please download manually from: https://github.com/yt-dlp/yt-dlp/releases/latest
        pause
        exit /b 1
    )
    echo yt-dlp installed successfully
) else (
    echo yt-dlp is already installed
)

REM Check for ffmpeg
echo Checking for ffmpeg...
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo WARNING: ffmpeg not found
    echo Please install ffmpeg from: https://ffmpeg.org/download.html
    echo After installation, make sure to add it to your system PATH
    set /p CONTINUE=Do you want to continue anyway? (Y/N): 
    if /i "!CONTINUE!" neq "Y" exit /b 1
) else (
    echo ffmpeg is already installed
)

echo Installing Node.js dependencies...
if exist "node_modules" (
    echo Node modules already exist, skipping installation
) else (
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install Node.js dependencies
        pause
        exit /b 1
    )
)

echo Installing required packages...
if exist "node_modules\node-windows" (
    echo node-windows already installed, skipping
) else (
    call npm install node-windows --save
    if errorlevel 1 (
        echo ERROR: Failed to install required packages
        pause
        exit /b 1
    )
)

REM Get the full path to node.exe
for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i
if not defined NODE_PATH (
    echo ERROR: Node.js not found in PATH
    pause
    exit /b 1
)

REM Get the current directory
set "CURRENT_DIR=%~dp0"
set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

echo Current directory: %CURRENT_DIR%
echo Node path: %NODE_PATH%

REM Check if server.js exists
if not exist "%CURRENT_DIR%\server.js" (
    echo ERROR: server.js not found in %CURRENT_DIR%
    pause
    exit /b 1
)

REM Remove existing service if it exists
echo Checking for existing service...
sc query "HDTube-Saver" >nul 2>&1
if %errorlevel% equ 0 (
    echo Found existing service, removing...
    sc stop "HDTube-Saver" >nul 2>&1
    timeout /t 2 /nobreak >nul
    sc delete "HDTube-Saver" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM Create the service
echo Creating Windows Service...
sc create "HDTube-Saver" binPath= "\"%NODE_PATH%\" \"%CURRENT_DIR%\server.js\"" start= auto DisplayName= "HDTube Saver Service"
if errorlevel 1 (
    echo ERROR: Failed to create service
    echo Error code: %errorlevel%
    pause
    exit /b 1
)

REM Set the service description
sc description "HDTube-Saver" "HDTube Saver Video Downloader Service"
if errorlevel 1 (
    echo WARNING: Failed to set service description
)

REM Start the service
echo Starting service...
sc start "HDTube-Saver"
if errorlevel 1 (
    echo WARNING: Failed to start service
    echo Checking service status...
    sc query "HDTube-Saver"
    echo.
    echo Please check Windows Event Viewer for more details
    echo Press any key to open Event Viewer...
    pause >nul
    eventvwr.msc
) else (
    echo Service started successfully!
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