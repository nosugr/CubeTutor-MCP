@echo off
title Smart Rubik Cube Platform
cd /d "%~dp0"

echo ========================================================
echo   Starting Backend & Frontend in a Single Terminal...
echo   Frontend: http://localhost:5173/
echo   Backend:  http://127.0.0.1:8000/
echo ========================================================
echo.

start "" http://localhost:5173/
npm start
