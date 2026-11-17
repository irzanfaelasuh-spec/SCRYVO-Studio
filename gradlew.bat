@echo off
where gradle >nul 2>nul
if errorlevel 1 (
  echo Gradle 8.10.2 is required. GitHub Actions installs it automatically.
  exit /b 1
)
gradle %*
