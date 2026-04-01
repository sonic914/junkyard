#!/bin/bash
# ─── EVACYCLE NAS 배포 스크립트 ───────────────────────────────────────────────
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# ─── 색상 출력 ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║    EVACYCLE NAS 배포 시작            ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 사전 검사 ────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  error ".env.prod 파일이 없습니다."
  echo "  cp .env.prod.example .env.prod 후 값을 설정해주세요."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  error "Docker가 설치되어 있지 않습니다."
  exit 1
fi

if ! command -v docker compose &>/dev/null && ! docker-compose version &>/dev/null 2>&1; then
  error "docker compose (또는 docker-compose)가 필요합니다."
  exit 1
fi

# docker compose v2 / v1 자동 감지
COMPOSE_CMD="docker compose"
if ! docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi

# ─── 환경변수 로드 ────────────────────────────────────────────────────────────
set -a; source "$ENV_FILE"; set +a

# ─── 필수 환경변수 확인 ───────────────────────────────────────────────────────
REQUIRED_VARS=(POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET JWT_REFRESH_SECRET
               MINIO_ACCESS_KEY MINIO_SECRET_KEY CORS_ORIGIN NEXT_PUBLIC_API_URL)
missing=()
for var in "${REQUIRED_VARS[@]}"; do
  val="${!var:-}"
  if [ -z "$val" ] || [[ "$val" == CHANGE_ME* ]]; then
    missing+=("$var")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  error ".env.prod에 설정되지 않은 필수 값:"
  for v in "${missing[@]}"; do echo "    - $v"; done
  exit 1
fi

# ─── 이전 컨테이너 중지 (다운타임 최소화) ────────────────────────────────────
info "이전 컨테이너 중지 중..."
$COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans || true

# ─── 이미지 빌드 ──────────────────────────────────────────────────────────────
info "Docker 이미지 빌드 중 (BUILD_STANDALONE=true)..."
BUILD_STANDALONE=true $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL"

# ─── 인프라 먼저 시작 (DB/Redis/MinIO) ───────────────────────────────────────
info "인프라 서비스 시작 (postgres / redis / minio)..."
$COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis minio

info "DB 준비 대기 중 (최대 60초)..."
timeout=60
while [ $timeout -gt 0 ]; do
  if $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
      exec -T postgres pg_isready -U "${POSTGRES_USER:-evacycle_user}" &>/dev/null; then
    info "PostgreSQL 준비 완료"
    break
  fi
  sleep 2; timeout=$((timeout - 2))
done
if [ $timeout -le 0 ]; then
  error "PostgreSQL 시작 시간 초과"
  exit 1
fi

# ─── 애플리케이션 시작 ────────────────────────────────────────────────────────
info "API + Web 서버 시작 중..."
$COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d api web

# ─── 헬스 체크 ────────────────────────────────────────────────────────────────
info "서버 준비 대기 중 (최대 60초)..."
sleep 10
api_ok=false
for i in $(seq 1 10); do
  if curl -sf "http://localhost:${API_PORT:-3000}/health" &>/dev/null; then
    api_ok=true; break
  fi
  sleep 5
done

echo ""
echo "  ╔══════════════════════════════════════╗"
if $api_ok; then
  echo "  ║  ✅ EVACYCLE 배포 완료!              ║"
else
  echo "  ║  ⚠️  배포 완료 (API 응답 미확인)     ║"
fi
echo "  ║                                      ║"
echo "  ║  프론트:  http://localhost:${WEB_PORT:-3001}      ║"
echo "  ║  API:     http://localhost:${API_PORT:-3000}      ║"
echo "  ║  MinIO:   http://localhost:${MINIO_CONSOLE_PORT:-9001}      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

info "로그 확인: $COMPOSE_CMD -f $COMPOSE_FILE logs -f api"
