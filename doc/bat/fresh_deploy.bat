@echo off
echo ========================================
echo DEPLOY LIMPO - APP APONTADOR
echo ========================================

echo.
echo [1/4] Verificando variáveis de ambiente...
set NODE_ENV=production
set PORT=5000
echo NODE_ENV=%NODE_ENV%
echo PORT=%PORT%

echo.
echo [2/4] Construindo imagem Docker...
docker build -t apontador-clean:latest .

echo.
echo [3/4] Iniciando container limpo...
docker run -d ^
  --name apontador-clean ^
  -p 5000:5000 ^
  -v "%cd%\apontador.db:/app/apontador.db" ^
  --restart unless-stopped ^
  apontador-clean:latest

echo.
echo [4/4] Verificando status...
timeout /t 3 >nul
docker ps | findstr apontador-clean

echo.
echo ========================================
echo DEPLOY CONCLUÍDO!
echo Acesse: http://localhost:5000
echo ========================================
pause