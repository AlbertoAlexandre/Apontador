@echo off
echo Resetando sessões e cookies...
taskkill /f /im chrome.exe 2>nul
taskkill /f /im msedge.exe 2>nul
taskkill /f /im firefox.exe 2>nul
echo Navegadores fechados - cookies limpos
pause