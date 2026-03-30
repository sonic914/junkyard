@echo off
chcp 65001 > nul
echo ====================================
echo  EVACYCLE 최초 설치
echo ====================================
echo.

echo [1/3] 의존성 설치 중...
call npm install
if %errorlevel% neq 0 (
    echo [!] npm install 실패. Node.js가 설치되어 있는지 확인하세요.
    pause
    exit /b 1
)

echo.
echo [2/3] 환경변수 파일 생성 중...
if not exist apps\api\.env (
    copy apps\api\.env.example apps\api\.env
    echo.
    echo *** apps\api\.env 파일을 열어서 설정을 확인해주세요 ***
    notepad apps\api\.env
) else (
    echo .env 파일이 이미 있습니다. 건너뜁니다.
)

echo.
echo [3/3] 설치 완료!
echo.
echo 이제 start.bat 을 실행하세요.
pause
