@echo off
echo Creating deployment package...

:: Create deployment directory if it doesn't exist
if not exist "deploy" mkdir deploy

:: Copy server files
copy server.js deploy\
copy package.json deploy\

:: Create temp directory
if not exist "deploy\temp" mkdir deploy\temp

echo Files copied successfully!
echo Please check the deploy folder for the deployment package.
pause 