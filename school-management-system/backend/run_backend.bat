@echo off
REM Run Django backend with local SQLite database
REM This script handles Windows PowerShell execution policy issues

cd /d "%~dp0"

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

REM Install minimal requirements for local dev (no Pillow, no psycopg2)
.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel >nul 2>&1

REM Install core packages
.venv\Scripts\python.exe -m pip install Django==5.0.3 >nul 2>&1
.venv\Scripts\python.exe -m pip install djangorestframework==3.15.1 >nul 2>&1
.venv\Scripts\python.exe -m pip install djangorestframework-simplejwt==5.3.1 >nul 2>&1
.venv\Scripts\python.exe -m pip install python-dotenv==1.0.1 >nul 2>&1
.venv\Scripts\python.exe -m pip install django-cors-headers==4.3.1 >nul 2>&1

echo.
echo Running migrations...
.venv\Scripts\python.exe manage.py migrate --settings=config.settings_local

echo.
echo Creating superuser (optional) - Press Ctrl+C to skip
echo.
.venv\Scripts\python.exe manage.py createsuperuser --settings=config.settings_local

echo.
echo ============================================
echo Starting development server...
echo ============================================
echo Backend URL: http://localhost:8000
echo Admin URL: http://localhost:8000/admin
echo.

.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000 --settings=config.settings_local
