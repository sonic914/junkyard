# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 파일 복사 (캐시 레이어 최적화)
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspace=apps/api --ignore-scripts

# 소스 복사 + 빌드
COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

# Prisma 클라이언트 생성
COPY apps/api/prisma ./apps/api/prisma
RUN npx --prefix apps/api prisma generate

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
RUN npm ci --workspace=apps/api --omit=dev --ignore-scripts

# Prisma 클라이언트 (생성된 파일 복사)
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma

# 빌드 결과물 + Prisma 스키마
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

USER nestjs

EXPOSE 3000

# DB 마이그레이션 후 서버 시작
CMD ["sh", "-c", "npx --prefix apps/api prisma migrate deploy && node apps/api/dist/main"]
