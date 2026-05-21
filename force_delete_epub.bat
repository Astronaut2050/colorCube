@echo off
chcp 65001 >nul
set "FILE=F:\pixiv\电子书\我的师傅-1.epub"

echo 正在尝试强制删除 epub 文件...
echo.

REM 结束可能占用该文件的常见程序
echo 正在关闭可能占用文件的程序...
taskkill /f /im calibre.exe 2>nul
taskkill /f /im "Adobe Digital Editions.exe" 2>nul
taskkill /f /im Kindle.exe 2>nul
taskkill /f /im "FBReader.exe" 2>nul
taskkill /f /im SumatraPDF.exe 2>nul
timeout /t 2 /nobreak >nul

REM 强制删除文件
del /f /q "%FILE%" 2>nul
if exist "%FILE%" (
    echo 删除失败，文件可能仍被占用。
    echo 请手动关闭打开该文件的程序后重试。
    echo 或使用: del /f /q "%FILE%"
    pause
    exit /b 1
) else (
    echo 已成功删除: %FILE%
    pause
    exit /b 0
)
