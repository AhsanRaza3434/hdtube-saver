@echo off
REM Install Node.js dependencies
npm install
npm install node-windows --save

REM Check for yt-dlp and ffmpeg
where yt-dlp >nul 2>nul
if errorlevel 1 (
    echo yt-dlp not found. Please install yt-dlp for Windows and add it to PATH.
    echo Download from: https://github.com/yt-dlp/yt-dlp/releases/latest
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo ffmpeg not found. Please install ffmpeg for Windows and add it to PATH.
    echo Download from: https://ffmpeg.org/download.html
)

REM Create service installation script
echo const Service = require('node-windows').Service; > install-service.js
echo const path = require('path'); >> install-service.js
echo. >> install-service.js
echo const svc = new Service({ >> install-service.js
echo   name: 'HDTube-Saver', >> install-service.js
echo   description: 'HDTube Saver Video Downloader Service', >> install-service.js
echo   script: path.join(__dirname, 'server.js'), >> install-service.js
echo   nodeOptions: [], >> install-service.js
echo   env: { >> install-service.js
echo     name: "NODE_ENV", >> install-service.js
echo     value: "production" >> install-service.js
echo   } >> install-service.js
echo }); >> install-service.js
echo. >> install-service.js
echo svc.on('install', function() { >> install-service.js
echo   svc.start(); >> install-service.js
echo   console.log('Service installed and started successfully!'); >> install-service.js
echo }); >> install-service.js
echo. >> install-service.js
echo svc.on('error', function(err) { >> install-service.js
echo   console.error('Service installation failed:', err); >> install-service.js
echo }); >> install-service.js
echo. >> install-service.js
echo svc.install(); >> install-service.js

REM Install the service
node install-service.js

echo.
echo Service installation completed. The application will now start automatically when the server restarts.
echo To manage the service, use Windows Services (services.msc)
echo.
pause 