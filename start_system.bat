@echo off
title Student Fee Management System (Offline)
cd /d "%~dp0"
echo ===================================================================
echo           STUDENT FEE MANAGEMENT SYSTEM — OFFLINE EDITION
echo                    Mr. Shrikant's Office Station
echo ===================================================================
if exist "dist\FeeManagementSystem\FeeManagementSystem.exe" (
    echo Starting compiled standalone application...
    start "" /d "%~dp0dist\FeeManagementSystem" "dist\FeeManagementSystem\FeeManagementSystem.exe"
) else (
    echo Starting local service via Python...
    python entrypoint.py
    pause
)
