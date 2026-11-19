@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\..\Ocean.exe" --expose-internals "%~dp0..\..\..\app.asar\ocean\node_modules\@deepseek-ai\ocean-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
