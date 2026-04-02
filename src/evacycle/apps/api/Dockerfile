# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 파일 복사 (캐시 레이어 최적화)
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Prisma 스키마 먼저 복사 (generate용)
COPY apps/api/prisma ./apps/api/prisma
COPY packages ./packages

RUN npm ci --workspace=apps/api --ignore-scripts

# Prisma 클라이언트 생성 (빌드 전에 먼저!)
RUN npx --prefix apps/api prisma generate

# 소스 복사 + 빌드
COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 보안: non-root 사용자
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

# 프로덕션 의존성만 설치
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY packages ./packages
RUN npm ci --workspace=apps/api --omit=dev --ignore-scripts
RUN npx --prefix apps/api prisma generate

# 빌드 결과물
COPY --from=builder /app/apps/api/dist ./apps/api/dist

USER nestjs

EXPOSE 3000

# DB 마이그레이션 후 서버 시작
CMD ["sh", "-c", "npx --prefix apps/api prisma migrate deploy && node apps/api/dist/main"]
