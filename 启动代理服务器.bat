@echo off
chcp 65001 >nul

:: 禁用快速编辑模式，防止点击窗口导致程序暂停
:: 通过修改注册表临时禁用（仅影响当前窗口）
>nul 2>&1 reg add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f

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
echo   [提示] 如果窗口"卡住"，按 ESC 或 回车 恢复
echo   [提示] 请勿点击此窗口，否则会暂停服务
echo.
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"
node proxy-server.js

pause
