@echo off
echo ========================================
echo PrintFree Backend Installation
echo ========================================
echo.

echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To run the application:
echo   python app.py
echo.
echo Then visit: http://localhost:5000
echo.
echo For Google OAuth setup, see SETUP_GUIDE.md
echo.
pause
