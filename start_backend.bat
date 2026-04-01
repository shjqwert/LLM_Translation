@echo off
chcp 65001 >nul
echo ========================================
echo   LLM 翻译后端启动器
echo ========================================
echo.

REM 检查Python环境
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.10+
    pause
    exit /b 1
)

echo [信息] 检查依赖...
cd /d "%~dp0backend"

REM 检查并安装依赖（可选，如果缺少包会提示）
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo [信息] 正在安装依赖...
    pip install -r requirements.txt
)

echo.
echo [信息] 启动后端服务...
echo [提示] 后端地址: http://127.0.0.1:50060
echo [提示] 按 Ctrl+C 停止服务
echo.

REM 启动uvicorn
python -m uvicorn backend.main:app --port 50060
