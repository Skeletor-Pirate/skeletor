@echo off
if exist "%~dp0dist\index.js" (
  node "%~dp0dist\index.js" %*
) else (
  npx --yes tsx "%~dp0src\index.ts" %*
)
