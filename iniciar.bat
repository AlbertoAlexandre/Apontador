@echo off
echo ========================================
echo    APONTADOR - Sistema de Viagens
echo ========================================
echo.
echo Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Instale o Node.js em: https://nodejs.org
    pause
    exit /b 1
)

echo.
echo Instalando dependencias...
npm install

echo.
echo Iniciando servidor...
echo.
echo Acesse: http://localhost:5000
echo Pressione Ctrl+C para parar
echo.
npm start

pause