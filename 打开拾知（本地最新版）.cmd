@echo off
setlocal
title Study Companion - Local
pushd "%~dp0"
if errorlevel 1 exit /b 1

set "ELECTRON_RUN_AS_NODE="
set "STUDY_COMPANION_DEV_URL="
if not defined STUDY_COMPANION_DATA_DIR set "STUDY_COMPANION_DATA_DIR=%CD%\user-data\local-preview"

if not exist "node_modules\electron\dist\electron.exe" (
  echo Dependencies are missing. Run npm ci in this project first.
  goto failed
)

echo [1/2] Building the latest local code. Please wait...
echo Close an older local preview before opening updated code.
call npm run desktop:build
if errorlevel 1 goto failed

echo [2/2] Opening Study Companion...
start "" "%CD%\node_modules\electron\dist\electron.exe" "%CD%"
if errorlevel 1 goto failed
popd
exit /b 0

:failed
echo.
echo Could not open the latest version. Check the error above.
pause
popd
exit /b 1
