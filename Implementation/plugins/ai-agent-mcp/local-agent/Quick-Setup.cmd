@echo off
setlocal
title ClusterOpt2 AI Agent MCP Quick Setup
cd /d "%~dp0"
if not exist "%~dp0Setup-Quick.ps1" (
  echo Missing Setup-Quick.ps1. Extract the complete plugin ZIP first.
  pause
  exit /b 1
)
echo AI Agent MCP (ChatGPT) - local setup
echo Source: https://github.com/xcxc84584-prog/ClusterOpt2
echo This script installs local dependencies and starts a loopback Agent.
choice /M "Continue"
if errorlevel 2 exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-Quick.ps1"
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" echo Setup failed. Check output above.
pause
exit /b %CODE%
