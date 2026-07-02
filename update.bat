@echo off
echo =========================================
echo    ENVIANDO ATUALIZACOES PARA O GITHUB
echo =========================================
echo.

:: 1. Pergunta o que foi alterado para colocar no commit
set /p mensagem="Digite o que voce mudou neste update: "

:: 2. Prepara os arquivos
git add .

:: 3. Cria o ponto de salvamento com a mensagem que voce digitou
git commit -m "%mensagem%"

:: 4. Envia para o GitHub
git push

echo.
echo =========================================
echo    ATUALIZADO COM SUCESSO!
echo =========================================
pause
