@echo off
setlocal
cd /d "%~dp0"

py -3 -c "import sys" >nul 2>&1
if not errorlevel 1 (
  set "RAPEE_PYTHON=py -3"
) else (
  python -c "import sys" >nul 2>&1
  if errorlevel 1 (
    echo ไม่พบ Python 3 กรุณาติดตั้งจาก https://www.python.org/downloads/ แล้วเปิดไฟล์นี้อีกครั้ง
    pause
    exit /b 1
  )
  set "RAPEE_PYTHON=python"
)

start "Rapee69 local server" /b %RAPEE_PYTHON% -m http.server 8080 > "%TEMP%\rapee69-server.log" 2>&1
powershell -NoProfile -Command "$ready=$false; 1..20 ^| %% { try { Invoke-WebRequest -UseBasicParsing http://localhost:8080/ -TimeoutSec 1 ^| Out-Null; $ready=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if(-not $ready){ exit 1 }"
if errorlevel 1 (
  echo เริ่มระบบไม่สำเร็จ กรุณาดูไฟล์ %TEMP%\rapee69-server.log
  pause
  exit /b 1
)
start "" http://localhost:8080/
echo ระบบพร้อมใช้งานแล้ว ปิดหน้าต่างนี้เมื่อเลิกใช้งาน
pause
