@echo off
title Fee Management System Launcher
cd /d "%~dp0"
if exist "dist\FeeManagementSystem\FeeManagementSystem.exe" (
    start "" /d "%~dp0dist\FeeManagementSystem" "dist\FeeManagementSystem\FeeManagementSystem.exe"
) else (
    python entrypoint.py
)
