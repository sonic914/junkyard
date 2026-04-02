# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

RUN npm ci --ignore-scripts
RUN cd apps/api && npx prisma generate

COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig*.json ./apps/api/
RUN npm run build --workspace=apps/api

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# 프로덕션 의존성 (root로 설치)
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci --omit=dev --ignore-scripts
RUN cd apps/api && npx prisma generate

# 빌드 결과물
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

# root로 migrate 후 서버 시작 (권한 문제 방지)
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/main"]
