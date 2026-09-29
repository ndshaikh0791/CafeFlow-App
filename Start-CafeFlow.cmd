@echo off
cd /d "%~dp0"
echo Starting CafeFlow database, backend and frontend...
echo Keep this window open. After startup, open http://localhost:5173
call npm run demo
pause
