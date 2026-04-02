# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
# 루트 node_modules에 설치됨 (npm workspaces)
RUN npm ci --workspace=apps/web --ignore-scripts

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 루트 node_modules만 복사 (workspace는 hoist됨)
COPY --from=deps /app/node_modules ./node_modules

COPY apps/web ./apps/web
COPY package*.json ./

# standalone 빌드
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ENV BUILD_STANDALONE=true
RUN npm run build --workspace=apps/web

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3001

CMD ["node", "apps/web/server.js"]
