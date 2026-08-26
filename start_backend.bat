@echo off
echo Starting HVS Backend Server...
cd /d C:\Users\Admin\Desktop\hvverify\hc-verify-main\backend
call venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
