@echo off
chcp 65001 >nul
echo.
echo ═══════════════════════════════════════════════════════
echo   启动统一服务器（代理 + AI图片放大）
echo ═══════════════════════════════════════════════════════
echo.
echo   服务地址: http://localhost:3456
echo   功能:
echo     - API代理（解决浏览器SSL问题）
echo     - AI图片放大（集成Upscayl）
echo.
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"
node proxy-server.js

pause
