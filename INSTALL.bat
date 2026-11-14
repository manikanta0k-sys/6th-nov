@echo off
cd /d "%~dp0"
py -3 --version >nul 2>&1
if errorlevel 1 (
 echo Python 3 not found. Install Python 3 with the Python launcher, then retry.
 pause
 exit /b 1
)
py -3 -m venv .venv
if errorlevel 1 goto fail
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto fail
echo Installation complete. Install Tesseract OCR separately, then open START.bat.
pause
exit /b 0
:fail
echo Installation failed. Check the error above and your internet connection.
pause
exit /b 1
