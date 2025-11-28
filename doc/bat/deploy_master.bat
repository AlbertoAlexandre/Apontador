@echo off
echo EXECUTANDO LIMPEZA COMPLETA...
call clean_deploy.bat

echo.
echo RESETANDO SESSÕES...
call reset_sessions.bat

echo.
echo INICIANDO DEPLOY LIMPO...
call fresh_deploy.bat

echo.
echo PROCESSO COMPLETO FINALIZADO!