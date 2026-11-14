@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo    ENVIAR ALTERACOES PARA TEST-VERSION
echo =========================================
echo.

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Esta pasta nao pertence a um repositorio Git.
    goto :fail
)

for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="test-version" (
    echo [ERRO] Esta script so envia a branch test-version.
    echo Branch atual: %CURRENT_BRANCH%
    echo Mude para test-version ou use update.bat para enviar a branch atual.
    goto :fail
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O remote origin nao esta configurado.
    goto :fail
)

echo Branch atual: %CURRENT_BRANCH%
echo.
echo Estado do repositorio:
git status --short
echo.
echo Este script NAO adiciona ficheiros automaticamente.
echo Prepare a staging area manualmente com git add <ficheiro>.
echo Reveja tambem os ficheiros staged com git diff --cached.
echo.

git diff --cached --quiet
if not errorlevel 1 (
    echo [ERRO] Nao existem alteracoes staged para commit.
    goto :fail
)

echo Resumo das alteracoes staged:
git diff --cached --stat
echo.
set /p mensagem="Mensagem do commit: "
if not defined mensagem (
    echo [ERRO] A mensagem do commit nao pode estar vazia.
    goto :fail
)

echo.
set /p confirmar="Criar commit e enviar para origin/test-version? [y/N]: "
if /I not "%confirmar%"=="Y" (
    echo Operacao cancelada.
    goto :end
)

git commit -m "%mensagem%"
if errorlevel 1 (
    echo [ERRO] O commit falhou. Verifique o estado do Git.
    goto :fail
)

git push -u origin test-version
if errorlevel 1 (
    echo [ERRO] O commit foi criado, mas o push falhou.
    echo O commit continua local. Corrija o problema e faca push manualmente.
    goto :fail
)

echo.
echo =========================================
echo    COMMIT E PUSH CONCLUIDOS
echo =========================================
goto :end

:fail
echo.
pause
exit /b 1

:end
echo.
pause
exit /b 0
