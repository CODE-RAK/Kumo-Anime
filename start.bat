@echo off
echo Starting ReAnime Python Backend...
uvicorn reanime:app --host 0.0.0.0 --port 8000 --reload
echo Backend is running on port 8000!
pause