@echo off
chcp 65001 >nul
"D:\anaconda\python.exe" "%~dp0txt_to_epub.py" %*
pause
