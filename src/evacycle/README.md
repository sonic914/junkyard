# EVACYCLE

전기차 배터리 재활용 플랫폼 - Monorepo

## 구조

```
evacycle/
├── apps/
│   ├── web/          # Next.js 14 프론트엔드
│   └── api/          # NestJS 백엔드 API
├── packages/
│   ├── shared/       # 공유 타입 & 유틸리티
│   └── blockchain/   # IBlockchainAdapter 인터페이스
└── docs/             # 프로젝트 문서
```

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 환경 실행 (Docker)
docker-compose up -d

# 앱 실행
npm run dev --workspace=apps/web
npm run dev --workspace=apps/api
```

## 기술 스택

- **Frontend:** Next.js 14, TypeScript, TailwindCSS
- **Backend:** NestJS, TypeScript, PostgreSQL
- **Blockchain:** IBlockchainAdapter (Ethereum / Polygon 지원 예정)
- **Infra:** Docker, PostgreSQL, Redis, MinIO
