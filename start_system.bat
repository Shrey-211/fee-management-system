@echo off
title Student Fee Management System (Offline)
cd /d "%~dp0"
echo ===================================================================
echo           STUDENT FEE MANAGEMENT SYSTEM — OFFLINE EDITION
echo                    Mr. Shrikant's Office Station
echo ===================================================================
echo Starting local service...
python entrypoint.py
pause

