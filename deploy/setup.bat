@echo off
echo Setting up HDTube-Saver Server...

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Create temp directory if it doesn't exist
if not exist "temp" mkdir temp

:: Install dependencies
echo Installing dependencies...
call npm install express body-parser cors ytdl-core

:: Install yt-dlp
echo Installing yt-dlp...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'yt-dlp.exe'"

echo Setup complete!
echo To start the server, run: node server.js
pause 