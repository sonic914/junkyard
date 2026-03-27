# EVACYCLE API — EV 폐차 부품 재활용 플랫폼

전기차 폐차 부품의 등록, 이력관리(CoC), 그레이딩, 판매, 정산을 관리하는 REST API 서버.

## 기술 스택

- **Backend**: NestJS 10 + TypeScript
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache/Session**: Redis 7
- **File Storage**: MinIO (S3 호환)
- **Auth**: OTP (이메일) + JWT (Access/Refresh)
- **Testing**: Jest + Supertest + k6

## 사전 요구사항

- Node.js >= 20
- Docker + Docker Compose
- (선택) k6 — 성능 테스트

## 빠른 시작

### 1. 환경 설정

```bash
# 루트 디렉토리에서
cp .env.production.template .env
# .env 파일 편집하여 실제 값 입력
```

### 2. 인프라 기동

```bash
docker compose up -d postgres redis minio
```

### 3. 의존성 설치

```bash
npm install
```

### 4. DB 마이그레이션 + 시드

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

### 5. 앱 실행

```bash
# 개발 모드
npm run dev

# 프로덕션
npm run build && npm run start:prod
```

### 6. Docker 전체 스택 (원클릭)

```bash
docker compose up -d --build
```

## 테스트

```bash
# 단위 테스트
npm run test

# E2E 테스트 (DB 필요)
npx jest --config test/jest-e2e.json --runInBand --forceExit

# 성능 테스트 (k6)
k6 run test/performance/k6-load-test.js --env BASE_URL=http://localhost:3000/v1
```

## API 문서

- **Swagger UI**: `http://localhost:3000/api/docs` (개발/스테이징 환경)
- **API Base URL**: `/v1`

### 주요 엔드포인트

| 모듈 | Method | Path | 설명 |
|------|--------|------|------|
| Auth | POST | `/v1/auth/otp/send` | OTP 발송 |
| Auth | POST | `/v1/auth/otp/verify` | OTP 검증 + JWT 발급 |
| Cases | POST | `/v1/cases` | Case 생성 (DRAFT) |
| Cases | POST | `/v1/cases/:id/submit` | Case 제출 (→ SUBMITTED) |
| Cases | POST | `/v1/cases/:id/transition` | 상태 전이 |
| Cases | GET | `/v1/cases/:id/timeline` | 타임라인 조회 |
| Gradings | POST | `/v1/cases/:id/gradings` | 그레이딩 생성 |
| Lots | POST | `/v1/lots/:id/listings` | Listing 생성 |
| Lots | POST | `/v1/lots/:id/purchase` | 구매 |
| Settlements | GET | `/v1/settlements` | 내 정산 조회 |
| Admin | GET | `/v1/admin/dashboard` | 대시보드 통계 |
| Admin | PATCH | `/v1/admin/settlements/:id` | 정산 승인/지급/거부 |
| Admin | POST | `/v1/admin/settlements/batch-approve` | 일괄 승인 |
| Admin | GET | `/v1/admin/ledger/verify-all` | 전체 해시 체인 검증 |

## 역할 (RBAC)

| 역할 | 설명 |
|------|------|
| OWNER | 폐차장 대표 |
| JUNKYARD | 폐차장 담당자 |
| INTAKE_JUNKYARD | 입고 폐차장 담당자 |
| HUB | 창고/허브 담당자 |
| BUYER | 구매사 담당자 |
| ADMIN | 플랫폼 관리자 |

## Case 상태 흐름

```
DRAFT → SUBMITTED → IN_TRANSIT → RECEIVED → GRADING → ON_SALE → SOLD → SETTLED
  └─────────────→ CANCELLED
```

## 환경 변수

루트 `.env.production.template` 참고.

## 프로젝트 구조

```
src/
├── admin/          # 관리자 도구 (조직/사용자/규칙/원장/대시보드)
├── auth/           # JWT + OTP 인증
├── cases/          # Case 생명주기 + 상태 머신
├── common/         # 공유 상수
├── config/         # 환경 설정
├── files/          # MinIO 파일 업로드/다운로드
├── grading/        # 듀얼 그레이딩
├── ledger/         # 이벤트 원장 (해시 체인)
├── lots/           # DerivedLot + Listing + 마켓플레이스
├── prisma/         # Prisma 서비스
├── settlements/    # M0+Δ 정산
└── users/          # 사용자 관리
```
