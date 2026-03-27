# EVACYCLE v1.0.0 — MVP Release

> **릴리즈 일자**: 2026-03-27
> **코드명**: Flow A Complete
> **QA 승인**: Vera (Conditional Pass)

---

## 개요

EVACYCLE은 전기차(EV) 폐차 부품의 등록, 이력관리, 그레이딩, 판매, 정산을 관리하는 B2B 플랫폼 API입니다. 이 릴리즈는 MVP(Minimum Viable Product)로서 Flow A(폐차장 등록 → 정산 완료) 전체 사이클을 지원합니다.

---

## 주요 기능

### 인증 및 접근제어 (CP1)
- OTP 기반 이메일 인증 (6자리, 5분 TTL)
- JWT Access/Refresh 토큰 (15분/7일)
- RBAC 6개 역할: OWNER, JUNKYARD, INTAKE_JUNKYARD, HUB, BUYER, ADMIN
- 역할 기반 API 접근 제어 (RolesGuard)

### Case 생명주기 관리 (CP2)
- 8단계 상태 머신: DRAFT → SUBMITTED → IN_TRANSIT → RECEIVED → GRADING → ON_SALE → SOLD → SETTLED
- 취소 지원: DRAFT/SUBMITTED → CANCELLED
- CoC(Chain of Custody) 서명 추적
- 파일 업로드: MinIO 기반 presigned URL (이미지 10MB, 문서 20MB)
- Case 타임라인: 전체 이벤트 이력 + 해시 체인 유효성 표시
- Case 번호 자동 생성: EVA-YYYYMM-NNNNN

### 그레이딩 및 판매 (CP3)
- 듀얼 그레이딩: Reuse Grade (A~D) + Recycle Grade (R1~R3)
- 라우팅 결정: REUSE / RECYCLE / DISCARD
- DISCARD 판정 시 Lot 미생성 (자동 필터링)
- DerivedLot 자동 생성 (Grading 완료 시)
- 고정가 Listing 생성 및 구매 플로우
- Lot 번호 자동 생성: LOT-YYYYMM-NNNNN

### M0+Delta 정산 시스템 (CP4)
- M0(기본) 정산: Case 제출 시 자동 생성, PartType별 m0BaseAmount 합산
- Delta(추가) 정산: Lot 판매 시 자동 생성, 판매가 x deltaRatio%
- 정산 상태 머신: PENDING → APPROVED → PAID (또는 REJECTED)
- 일괄 승인 (batch-approve): 다건 Settlement 한번에 APPROVED 전이
- 전체 Settlement PAID 시 Case 자동 SETTLED 전이
- SettlementRule 스냅샷 기록 (감사 추적)

### 관리자 도구 (CP4)
- 조직 관리 (CRUD): JUNKYARD, HUB, BUYER, PLATFORM
- 사용자 관리: 역할별 생성/수정
- GradingRule 관리: PartType별 조건 설정
- SettlementRule 관리: m0BaseAmount + deltaRatio 설정
- 대시보드: Case/Settlement 통계
- 이벤트 원장 조회 및 검증

### 데이터 무결성 (CP1~CP5)
- EventLedger 해시 체인: SHA-256, 순차 seq, prevHash 연결
- 결정적 JSON 직렬화 (키 알파벳 정렬)
- 해시 체인 검증 API: 단일 Case 및 전체 시스템
- 불변 이벤트 원장: 생성 후 수정/삭제 불가

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| Backend | NestJS 10 + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache/Session | Redis 7 |
| File Storage | MinIO (S3 호환) |
| Auth | OTP (이메일) + JWT (Access/Refresh) |
| Testing | Jest + Supertest (E2E), k6 (성능) |
| Container | Docker + Docker Compose |

---

## 테스트 현황

### E2E 테스트 (4개 시나리오)
- **S1**: Happy Path — Case 생성부터 SETTLED까지 전체 Flow A (12 steps)
- **S2**: Cancel Flow — SUBMITTED/DRAFT 상태 취소 + 전이 불가 검증
- **S3**: Multi-Lot — BATTERY(REUSE) + MOTOR(RECYCLE) + BODY(DISCARD) 복합 정산
- **S4**: Batch Settlement — 3 Cases x 6 Settlements 일괄 승인/지급

### 단위 테스트 (6개 spec)
- Case 서비스 + 상태 머신
- Settlement 서비스 + 상태 머신 + 자동 생성 Hook
- Admin 서비스

### 성능 테스트 (k6)
- 50 VU / 30초 부하
- Health, Login, Case List, Lot List, Marketplace, Auth Me

---

## API 엔드포인트

| 모듈 | Method | Path | 설명 |
|------|--------|------|------|
| Auth | POST | `/v1/auth/otp/send` | OTP 발송 |
| Auth | POST | `/v1/auth/otp/verify` | OTP 검증 + JWT 발급 |
| Auth | POST | `/v1/auth/token/refresh` | 토큰 갱신 |
| Auth | GET | `/v1/auth/me` | 내 정보 |
| Cases | POST | `/v1/cases` | Case 생성 |
| Cases | POST | `/v1/cases/:id/submit` | 제출 |
| Cases | POST | `/v1/cases/:id/cancel` | 취소 |
| Cases | POST | `/v1/cases/:id/transition` | 상태 전이 |
| Cases | GET | `/v1/cases/:id/timeline` | 타임라인 |
| Files | POST | `/v1/cases/:id/files/presign` | Presigned URL |
| Gradings | POST | `/v1/cases/:id/gradings` | 그레이딩 |
| Lots | POST | `/v1/lots/:id/listings` | Listing 생성 |
| Lots | POST | `/v1/lots/:id/purchase` | 구매 |
| Settlements | GET | `/v1/settlements` | 내 정산 조회 |
| Admin | GET | `/v1/admin/dashboard` | 대시보드 |
| Admin | PATCH | `/v1/admin/settlements/:id` | 정산 상태 변경 |
| Admin | POST | `/v1/admin/settlements/batch-approve` | 일괄 승인 |
| Admin | GET | `/v1/admin/ledger/verify` | 해시 체인 검증 |

---

## Case 상태 흐름

```
DRAFT → SUBMITTED → IN_TRANSIT → RECEIVED → GRADING → ON_SALE → SOLD → SETTLED
  └───────────────→ CANCELLED
```

---

## 알려진 제한 사항

1. **파일 업로드 E2E 미검증**: MinIO presigned URL 플로우는 단위 테스트 수준에서만 검증
2. **RBAC 음성 테스트 부족**: 잘못된 역할의 API 접근 차단(403)에 대한 전용 E2E 테스트 미구현
3. **성능 SLA**: k6 threshold가 설계서 SLA보다 완화된 기준으로 설정
4. **단일 Flow만 지원**: Flow A(일반 폐차)만 구현. Flow B(대량 처리) 등은 향후 릴리즈
5. **프론트엔드 미포함**: API 서버만 포함, 웹 UI는 별도 프로젝트

---

## v1.1 로드맵

- [ ] RBAC 음성 테스트 추가 (6역할 x 9 API = 54 케이스)
- [ ] 파일 업로드 E2E 테스트
- [ ] Integration 테스트 5개 파일
- [ ] k6 SLA 기준 설계서 일치 + 5단계 부하 패턴
- [ ] 취소 시 M0 Settlement REJECTED 처리 로직 명확화
- [ ] Swagger 문서 완성도 검수

---

*Built by Finn (Backend) | Designed by Arlo (Architect) | QA by Vera*
