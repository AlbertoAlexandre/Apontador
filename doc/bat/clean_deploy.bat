@echo off
echo ========================================
echo LIMPEZA COMPLETA DO AMBIENTE APONTADOR
echo ========================================

echo.
echo [1/5] Parando containers Docker existentes...
docker-compose down --remove-orphans 2>nul
docker stop apontador-app 2>nul
docker rm apontador-app 2>nul

echo.
echo [2/5] Removendo imagens Docker antigas...
docker rmi apontador_apontador 2>nul
docker rmi app_apontador_apontador 2>nul

echo.
echo [3/5] Limpando cache npm e node_modules...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
npm cache clean --force

echo.
echo [4/5] Limpando arquivos temporários...
if exist *.log del *.log
if exist *.tmp del *.tmp
if exist .env.local del .env.local

echo.
echo [5/5] Reinstalando dependências...
npm install

echo.
echo ========================================
echo LIMPEZA CONCLUÍDA!
echo ========================================
pause