@echo off
if exist "%~dp0dist\cli\openliate.exe" (
  "%~dp0dist\cli\openliate.exe" %*
) else (
  node "%~dp0dist\bin.js" %*
)
