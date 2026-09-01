@echo off
REM Avvia FantaDash: serve la cartella dist/ in locale e apre il browser.
REM Serve Node.js installato (nodejs.org). Funziona anche su Windows ARM.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Installalo da https://nodejs.org e riprova.
  echo In alternativa apri dist\index.html nel browser: funziona, ma senza salvataggio automatico.
  pause
  exit /b 1
)
node scripts\serve.mjs %1
