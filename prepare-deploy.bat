@echo off
REM Create deployment folder
mkdir deploy-server

REM Copy server and dependencies
copy server.js deploy-server\
copy package.json deploy-server\
copy package-lock.json deploy-server\

REM Copy temp folder (empty)
mkdir deploy-server\temp

REM Copy built frontend
xcopy /E /I /Y dist deploy-server\dist

REM Copy public folder
xcopy /E /I /Y public deploy-server\public

echo Deployment folder prepared: deploy-server
echo Move this folder to your AWS Windows server. 