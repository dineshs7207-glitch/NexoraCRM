@echo off
rem Starts the Nexora web app on this computer and opens it in the browser. Close this window to stop it.
cd /d "C:\Users\dines\OneDrive\Desktop\ClaudeCode\NexoraCRM"
title Nexora - keep this window open while you use the app
start "" /b cmd /c "timeout /t 8 >nul && start http://localhost:5173/"
call pnpm --filter @nexora/web exec vite --port 5173
