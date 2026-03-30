@echo off
chcp 65001 > nul
echo.
echo  ╔═══════════════════════════════════════╗
echo  ║        EVACYCLE 시작 중...            ║
echo  ╚═══════════════════════════════════════╝
echo.

:: 환경변수 파일 확인
if not exist "apps\api\.env" (
    echo [!] apps\api\.env 파일이 없습니다.
    echo     apps\api\.env.example 을 복사해서 설정해주세요:
    echo     copy apps\api\.env.example apps\api\.env
    echo.
    pause
    exit /b 1
)

echo [1/4] 인프라 시작 ^(PostgreSQL / Redis / MinIO^)
docker-compose up -d
if %errorlevel% neq 0 (
    echo [!] Docker 실행 실패. Docker Desktop이 실행 중인지 확인하세요.
    pause
    exit /b 1
)
echo     DB/Redis/MinIO 준비 대기 중 ^(5초^)...
timeout /t 5 /nobreak > nul

echo.
echo [2/4] 의존성 설치 ^(npm install^)
call npm install
if %errorlevel% neq 0 (
    echo [!] npm install 실패.
    pause
    exit /b 1
)

echo.
echo [3/4] DB 스키마 동기화 ^(prisma db push^)
cd apps\api
call npx prisma db push
if %errorlevel% neq 0 (
    echo [!] DB 마이그레이션 실패. DATABASE_URL 환경변수를 확인하세요.
    cd ..\..
    pause
    exit /b 1
)

echo.
echo     시드 데이터 적용 중...
call npx prisma db seed 2>nul || echo     ^(시드 없음 — 건너뜀^)
cd ..\..

echo.
echo [4/4] 서버 시작
echo     API  서버: apps\api  ^(포트 3000^)
echo     프론트:    apps\web  ^(포트 3001^)
echo.

start "EVACYCLE API" cmd /k "cd /d %~dp0apps\api && echo API 서버 시작 중... && npm run start:dev"
timeout /t 3 /nobreak > nul
start "EVACYCLE WEB" cmd /k "cd /d %~dp0apps\web && echo 프론트 서버 시작 중... && npm run dev"

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║  ✅ EVACYCLE 시작 완료!               ║
echo  ║                                       ║
echo  ║  프론트:  http://localhost:3001        ║
echo  ║  API:     http://localhost:3000        ║
echo  ║  MinIO:   http://localhost:9001        ║
echo  ║  Swagger: http://localhost:3000/docs   ║
echo  ╚═══════════════════════════════════════╝
echo.
echo  두 터미널 창이 열렸습니다.
echo  API 준비까지 약 10-20초 소요됩니다.
echo.
pause
