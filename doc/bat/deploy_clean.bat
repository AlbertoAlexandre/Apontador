@echo off
echo ========================================
echo DEPLOY LIMPO - APONTADOR
echo ========================================

echo.
echo Este script vai executar uma limpeza completa e deploy do App Apontador
echo.
pause

echo.
echo [1/8] Parando todos os processos Node.js...
taskkill /f /im node.exe 2>nul
timeout /t 3 >nul

echo.
echo [2/8] Limpando cache e arquivos temporarios...
call clean_environment.bat

echo.
echo [3/8] Verificando ambiente...
call check_environment.bat

echo.
echo [4/8] Resetando sessoes...
call reset_sessions.bat

echo.
echo [5/8] Verificando integridade dos arquivos...
if not exist server.js (
    echo ERRO: server.js nao encontrado!
    pause
    exit /b 1
)

if not exist package.json (
    echo ERRO: package.json nao encontrado!
    pause
    exit /b 1
)

echo.
echo [6/8] Testando conexao com banco de dados...
node -e "const sqlite3 = require('sqlite3'); const db = new sqlite3.Database('apontador.db'); console.log('Banco OK'); db.close();"

echo.
echo [7/8] Iniciando servidor em modo producao...
set NODE_ENV=production
set PORT=5000

echo.
echo [8/8] Servidor iniciado!
echo ========================================
echo DEPLOY CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo Acesse: http://localhost:5000
echo Usuario: adm
echo Senha: 123
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

npm start