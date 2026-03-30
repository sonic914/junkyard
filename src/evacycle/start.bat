@echo off
chcp 65001 > nul
echo ====================================
echo  EVACYCLE 시작
echo ====================================
echo.

echo [1/4] 최신 코드 받는 중...
git pull origin main

echo.
echo [2/4] 인프라 시작 (DB / Redis / MinIO)...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [!] Docker 실행 실패. Docker Desktop이 실행 중인지 확인하세요.
    pause
    exit /b 1
)
timeout /t 8 /nobreak

echo.
echo [3/4] 새 패키지 확인 중...
call npm install --silent

echo.
echo [4/4] 서버 시작 중...
start "EVACYCLE API" cmd /k "cd /d %~dp0apps\api && npx prisma db push --accept-data-loss && npm run start:dev"
timeout /t 5 /nobreak
start "EVACYCLE Web" cmd /k "cd /d %~dp0apps\web && npm run dev"

echo.
echo ====================================
echo  실행 완료!
echo  프론트:  http://localhost:3001
echo  API:     http://localhost:3000
echo  MinIO:   http://localhost:9001
echo ====================================
pause
