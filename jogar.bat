@echo off
echo =========================================
echo    BLOONS 5.5 - A INICIAR O JOGO
echo =========================================
echo.
echo A instalar dependencias (so demora na primeira vez)...
call npm install
echo.
echo A iniciar o servidor. O browser vai abrir sozinho.
call npm run dev -- --open
pause
