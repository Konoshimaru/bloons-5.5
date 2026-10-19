@echo off
echo =========================================
echo    BLOONS 5.5 - A INICIAR O JOGO
echo =========================================
echo.
call npm ci
echo.
call npm run dev -- --open
pause
