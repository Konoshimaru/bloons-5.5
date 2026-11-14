@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo    BLOONS 5.5 - A INICIAR O JOGO
echo =========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao foi encontrado. Instale Node.js 22 ou superior.
    goto :fail
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERRO] npm nao foi encontrado. Reinstale o Node.js com npm.
    goto :fail
)

if not exist "node_modules\vite\bin\vite.js" (
    echo Dependencias nao encontradas. A instalar com npm ci...
    call npm ci
    if errorlevel 1 (
        echo [ERRO] A instalacao das dependencias falhou.
        goto :fail
    )
) else (
    echo Dependencias encontradas. A saltar npm ci.
    echo Se o package-lock.json mudou, execute npm ci manualmente.
)

echo.
call npm run dev -- --open
if errorlevel 1 (
    echo [ERRO] O servidor de desenvolvimento nao iniciou corretamente.
    goto :fail
)

goto :end

:fail
echo.
pause
exit /b 1

:end
echo.
pause
exit /b 0
