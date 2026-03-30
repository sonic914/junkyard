# EVACYCLE

전기차 배터리 재활용 플랫폼 - Monorepo

## Windows 실행 방법

### 최초 1회
1. 이 폴더에서 `install.bat` 실행
2. `.env` 파일 설정 확인 (자동으로 메모장 열림)

### 매번 실행
1. `start.bat` 더블클릭
2. http://localhost:3001 접속

---

## 구조

```
evacycle/
├── apps/
│   ├── web/          # Next.js 14 프론트엔드 (포트 3001)
│   └── api/          # NestJS 백엔드 API (포트 3000)
├── packages/
│   ├── shared/       # 공유 타입 & 유틸리티
│   └── blockchain/   # IBlockchainAdapter 인터페이스
├── docs/             # 프로젝트 문서
├── start.bat         # Windows 원클릭 실행 스크립트
└── docker-compose.yml
```

---

## 🪟 Windows 원클릭 실행 (권장)

> **사전 요구사항:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) + [Node.js 18+](https://nodejs.org/)

### 최초 실행

```
1. apps/api/.env.example → apps/api/.env 로 복사
2. .env 파일에서 비밀번호 등 값 수정 (개발 환경은 기본값 사용 가능)
3. start.bat 더블클릭
```

```batch
:: .env 복사 (최초 1회)
copy apps\api\.env.example apps\api\.env
```

### 재실행 (이후)

```batch
:: 단순 재시작 (DB/의존성 설치 생략)
docker-compose up -d
start cmd /k "cd apps\api && npm run start:dev"
start cmd /k "cd apps\web && npm run dev"
```

### 접속 주소

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:3001 |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |
| MinIO 콘솔 | http://localhost:9001 |

---

## 🐧 macOS / Linux 실행

```bash
# 1. 환경변수 설정 (최초 1회)
cp apps/api/.env.example apps/api/.env

# 2. 인프라 시작
docker-compose up -d

# 3. 의존성 설치 (최초 1회)
npm install

# 4. DB 스키마 적용 (최초 1회)
cd apps/api && npx prisma db push && cd ../..

# 5. 개발 서버 실행 (터미널 2개)
npm run dev:api   # 터미널 1
npm run dev:web   # 터미널 2
```

---

## 🔑 환경변수

`apps/api/.env.example` 참고. 개발 환경 기본값으로 바로 실행 가능합니다.

주요 항목:

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | localhost:5432 |
| `JWT_SECRET` | 액세스 토큰 서명 키 | ⚠️ 프로덕션에서 반드시 변경 |
| `MINIO_ACCESS_KEY` | MinIO 관리자 ID | minioadmin |

---

## 🧪 테스트

```bash
# 유닛 테스트
npm test --workspace=apps/api

# E2E 테스트 (서버 실행 중 상태에서)
cd apps/web && npx playwright test
```

---

## 역할별 시드 계정 (개발 환경)

| 역할 | 이메일 |
|------|--------|
| 관리자 | admin@evacycle.com |
| 폐차장 | junkyard@evacycle.com |
| 허브 | hub@evacycle.com |
| 바이어 | buyer@evacycle.com |

> OTP는 개발 환경(`NODE_ENV=development`)에서 API 응답에 포함됩니다.
