@echo off
cd /d "%~dp0"
set "BIRD_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "BIRD_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Node.js is required. Install it from https://nodejs.org then run this again.
    pause
    exit /b 1
  )
)
start "" http://127.0.0.1:8787/advanced/
"%BIRD_NODE%" server.mjs
pause
