# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 루트 패키지 파일 복사
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# 전체 의존성 설치 (루트 워크스페이스 기준)
RUN npm ci --ignore-scripts

# Prisma 스키마 복사 후 generate (루트에서 실행)
COPY apps/api/prisma ./apps/api/prisma
RUN cd apps/api && npx prisma generate

# 소스 복사 + 빌드
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig*.json ./apps/api/
RUN npm run build --workspace=apps/api

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

# 프로덕션 의존성
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci --omit=dev --ignore-scripts
RUN cd apps/api && npx prisma generate

# 빌드 결과물
COPY --from=builder /app/apps/api/dist ./apps/api/dist

USER nestjs

EXPOSE 3000

CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/main"]
