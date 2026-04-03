# EVACYCLE 프로젝트 인수인계 (Claude Code용)

## 프로젝트 개요
- **스택**: Next.js (프론트) + NestJS (백엔드) + Prisma + PostgreSQL + MinIO
- **인증**: OTP 이메일 로그인 + JWT (access 15분 / refresh 7일)
- **상태관리**: Zustand (프론트)
- **GitHub**: git@github.com:sonic914/junkyard.git

## 코드베이스 구조
```
apps/
  api/          # NestJS 백엔드 (포트 3100)
  web/          # Next.js 프론트엔드 (포트 3101)
packages/
  shared/       # 공통 타입/유틸
```

## 주요 도메인
- **Case**: 8단계 상태머신 (DRAFT→SUBMITTED→IN_TRANSIT→RECEIVED→GRADING→ON_SALE→SOLD→SETTLED)
- **RBAC**: 6역할 (OWNER, JUNKYARD, INTAKE_JUNKYARD, HUB, BUYER, ADMIN)
- **Grading**: 듀얼 그레이딩 (Reuse A~D / Recycle R1~R3)
- **Settlement**: M0+Delta 정산 시스템

## 현재 미완료 이슈 (COD-57~63)
- COD-57: CoC 서명 시 허브 자동 배정
- COD-58: 입고 확인 후 invalidateQueries
- COD-59: CHARGER enum schema.prisma 추가
- COD-60: grading-tab.tsx 파일 생성
- COD-63: REUSE Lot → Listing 자동 생성
- 작업 브랜치: feature/cod-56-63-v2

## 버그 패턴 주의
- Zustand hydration: 첫 렌더 시 user=null → mounted 가드 필요
- RBAC nav 경로: 역할별 nav 항목 반드시 확인
- MinIO presigned URL: 내부 주소 → MINIO_PUBLIC_URL 교체 필요

## 개발 규칙
- 커밋 메시지: `feat: COD-XX 내용` 형식
- 완료 후 반드시 git push
- 작업 완료 시: `openclaw system event --text "코코 완료: COD-XX" --mode now`
