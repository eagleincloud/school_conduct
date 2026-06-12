@echo off
REM Run Django backend with configured PostgreSQL database
REM This script handles Windows PowerShell execution policy issues

cd /d "%~dp0"

if "%BACKEND_HOST%"=="" set "BACKEND_HOST=13.233.140.195"

echo ============================================
echo School Management System - Backend Setup
echo ============================================
echo.

REM Check if venv exists
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    echo Virtual environment created.
)

echo.
echo Activating virtual environment and installing packages...
echo.

REM Install backend requirements, including PostgreSQL support
.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel >nul 2>&1
.venv\Scripts\python.exe -m pip install -r requirements.txt

echo.
echo Running migrations...
set "DJANGO_SETTINGS_MODULE=config.settings_local"
.venv\Scripts\python.exe manage.py migrate --settings=config.settings_local

echo.
echo Creating superuser (optional) - Press Ctrl+C to skip
echo.
.venv\Scripts\python.exe manage.py createsuperuser --settings=config.settings_local

echo.
echo ============================================
echo Starting development server...
echo ============================================
if "%BACKEND_HOST%"=="" set "BACKEND_HOST=13.233.140.195"
echo Backend URL: http://%BACKEND_HOST%:8000
echo Admin URL: http://%BACKEND_HOST%:8000/admin
echo.

set "DJANGO_SETTINGS_MODULE=config.settings_local"
.venv\Scripts\python.exe manage.py runserver %BACKEND_HOST%:8000 --settings=config.settings_local
