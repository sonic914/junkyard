@echo off
chcp 65001 > nul
echo ====================================
echo  EVACYCLE 데모 환경 시작
echo ====================================
echo.

:: 환경변수 파일 확인
if not exist "apps\api\.env" (
    echo [!] apps\api\.env 파일이 없습니다.
    echo     먼저 install.bat 을 실행해주세요.
    pause
    exit /b 1
)

echo [1/5] 인프라 시작 (DB / Redis / MinIO)...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [!] Docker 실행 실패. Docker Desktop이 실행 중인지 확인하세요.
    pause
    exit /b 1
)
echo     DB 준비 대기 중 (8초)...
timeout /t 8 /nobreak

echo.
echo [2/5] 패키지 설치...
call npm install --silent

echo.
echo [3/5] DB 초기화 + 데모 데이터 세팅...
cd apps\api
call npx prisma db push --force-reset --accept-data-loss
if %errorlevel% neq 0 (
    echo [!] DB 초기화 실패.
    cd ..\..
    pause
    exit /b 1
)
call npx ts-node prisma/demo-seed.ts
if %errorlevel% neq 0 (
    echo [!] 데모 시드 실패.
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

echo.
echo [4/5] 서버 시작...
start "EVACYCLE API" cmd /k "cd /d %~dp0apps\api && npm run start:dev"
echo     API 준비 대기 중 (5초)...
timeout /t 5 /nobreak
start "EVACYCLE Web" cmd /k "cd /d %~dp0apps\web && npm run dev"

echo.
echo ====================================
echo  데모 준비 완료!
echo  http://localhost:3001
echo.
echo  [데모 계정] (OTP: API 터미널 콘솔 확인)
echo  폐차장: junkyard@evacycle.com
echo  허브:   hub@evacycle.com
echo  바이어: buyer@evacycle.com
echo  관리자: admin@evacycle.com
echo.
echo  [샘플 데이터]
echo  케이스 4개 (DRAFT/SUBMITTED/IN_TRANSIT/ON_SALE)
echo  Lot 1개 (배터리 Grade A, 판매가 1,850,000원)
echo  정산 1건 (M0, 142,500원 PENDING)
echo ====================================
pause
