@echo off
chcp 65001 >nul
echo ========================================
echo   Cloudflare Workers Proxy - 本地开发
echo ========================================
echo.
echo 正在启动本地开发服务器...
echo.
echo 服务器地址: http://127.0.0.1:8787
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

wrangler dev

pause
