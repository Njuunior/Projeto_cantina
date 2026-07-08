@echo off
chcp 65001 >nul
title Escola Cantina - Iniciar sistema
cd /d "%~dp0"

echo.
echo  ============================================
echo   Escola Cantina - Subindo todos os servicos
echo  ============================================
echo.

echo [1/3] Liberando portas 4000, 5173 e 8765...
powershell -NoProfile -Command "foreach ($port in 4000,5173,8765) { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak >nul

echo [2/3] Abrindo 3 janelas (API, Site, RFID)...
start "Escola - API (porta 4000)" cmd /k "cd /d ""%~dp0"" && title Escola - API ^(4000^) && npm run dev:api"
timeout /t 2 /nobreak >nul
start "Escola - Web (porta 5173)" cmd /k "cd /d ""%~dp0"" && title Escola - Web ^(5173^) && npm run dev:web"
timeout /t 2 /nobreak >nul
start "Escola - RFID (porta 8765)" cmd /k "cd /d ""%~dp0"" && title Escola - RFID ^(8765^) && npm run dev:rfid"

echo.
echo [3/3] Pronto!
echo.
echo   Cantina:  http://localhost:5173/
echo   Admin:    http://localhost:5173/admin
echo   API:      http://localhost:4000/api/health
echo.
echo   Login admin: admin / admin123
echo.
echo   Mantenha as 3 janelas abertas enquanto usar o sistema.
echo.
pause
