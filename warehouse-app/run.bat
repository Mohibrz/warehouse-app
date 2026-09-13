@echo off
chcp 65001 >nul
echo ===================================
echo نظام إدارة المخازن - تشغيل
echo ===================================
echo.

REM Check if venv exists
if not exist venv\Scripts\activate.bat (
    echo إنشاء البيئة الافتراضية...
    python -m venv venv
    call venv\Scripts\activate.bat
    venv\Scripts\python.exe -m pip install --upgrade pip
    venv\Scripts\python.exe -m pip install -r backend\requirements.txt
) else (
    REM Activate venv
    echo تفعيل البيئة...
    call venv\Scripts\activate.bat
)

REM Check if Tailscale Serve is active
tailscale serve status >nul 2>&1
if %errorlevel% == 0 (
    echo Tailscale Serve: مفعّل
) else (
    echo Tailscale Serve: غير مفعّل - شغّل 'tailscale serve 9000' يدوياً
)

echo.
echo ===================================
echo روابط الوصول
echo ===================================
echo محلياً:      http://localhost:9000
echo Tailscale:  https://desktop-vlbl3dk.tail4614ad.ts.net
echo API:        http://localhost:9000/docs
echo.
echo المستخدم: admin
echo كلمة المرور: admin123
echo.
echo اضغط Ctrl+C للإيقاف
echo ===================================
echo.

REM Start the server using venv python
venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
pause
