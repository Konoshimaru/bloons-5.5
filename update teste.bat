@echo off
echo =========================================
echo    ENVIANDO ATUALIZACOES PARA O GITHUB
echo =========================================
echo.

set /p mensagem="Digite o que voce mudou neste update: "

git add .
git commit -m "%mensagem%"
git push -u origin test-version

echo.
echo =========================================
echo    ATUALIZADO COM SUCESSO!
echo =========================================
pause