@echo off
echo ========================================
echo LIMPANDO CACHE DO NAVEGADOR
echo ========================================

echo.
echo 1. Fechando todos os navegadores...
taskkill /f /im chrome.exe 2>nul
taskkill /f /im firefox.exe 2>nul
taskkill /f /im msedge.exe 2>nul
taskkill /f /im iexplore.exe 2>nul

echo.
echo 2. Aguardando 3 segundos...
timeout /t 3 /nobreak >nul

echo.
echo 3. Limpando cache do Chrome...
if exist "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache" (
    rd /s /q "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache" 2>nul
    echo Cache do Chrome limpo!
) else (
    echo Cache do Chrome nao encontrado.
)

echo.
echo 4. Limpando cache do Edge...
if exist "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache" (
    rd /s /q "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache" 2>nul
    echo Cache do Edge limpo!
) else (
    echo Cache do Edge nao encontrado.
)

echo.
echo 5. Limpando cache do Firefox...
if exist "%APPDATA%\Mozilla\Firefox\Profiles" (
    for /d %%i in ("%APPDATA%\Mozilla\Firefox\Profiles\*") do (
        if exist "%%i\cache2" rd /s /q "%%i\cache2" 2>nul
    )
    echo Cache do Firefox limpo!
) else (
    echo Cache do Firefox nao encontrado.
)

echo.
echo 6. Limpando arquivos temporarios do Windows...
del /q /f "%TEMP%\*" 2>nul
for /d %%i in ("%TEMP%\*") do rd /s /q "%%i" 2>nul

echo.
echo ========================================
echo CACHE LIMPO COM SUCESSO!
echo ========================================
echo.
echo Agora abra o navegador e acesse:
echo http://localhost:5000
echo.
echo Pressione Ctrl+F5 para forcar o reload
echo ========================================
pause