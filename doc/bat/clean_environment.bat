@echo off
echo ========================================
echo LIMPEZA COMPLETA DO AMBIENTE APONTADOR
echo ========================================

echo.
echo [1/5] Parando processos Node.js...
taskkill /f /im node.exe 2>nul
timeout /t 2 >nul

echo.
echo [2/5] Limpando cache do npm...
npm cache clean --force

echo.
echo [3/5] Removendo node_modules...
if exist node_modules (
    rmdir /s /q node_modules
    echo Node_modules removido
) else (
    echo Node_modules nao encontrado
)

echo.
echo [4/5] Removendo arquivos temporarios...
del /q *.tmp 2>nul
del /q *.log 2>nul
del /q package-lock.json 2>nul

echo.
echo [5/5] Reinstalando dependencias...
npm install

echo.
echo ========================================
echo LIMPEZA CONCLUIDA!
echo ========================================
echo.
echo Para iniciar o servidor: npm start
echo Acesse: http://localhost:5000
echo.
pause