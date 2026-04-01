/**
 * COD-28 — CORS/쿠키/인증 브라우저 E2E 테스트
 *
 * 목적:
 *   - 서버사이드 테스트(k6/Jest)에서 탐지 불가한 브라우저 레벨 이슈 검증
 *   - COD-15(API CORS), COD-20(MinIO CORS) 유사 재발 방지
 *   - httpOnly 쿠키 기반 refreshToken 흐름 검증
 *   - CORS 헤더(Access-Control-Allow-Origin, Allow-Credentials) 정상 응답 확인
 *
 * 전제:
 *   - localhost:3000 (NestJS API, NODE_ENV=development)
 *   - localhost:3001 (Next.js 프론트엔드)
 *   - MinIO: localhost:9000
 */
import { test, expect, Page, Request, Response, APIResponse } from '@playwright/test';
import { loginAs, getAccessToken } from './helpers/login';

const API_BASE  = process.env.API_URL  ?? 'http://localhost:3000/v1';
const WEB_BASE  = process.env.BASE_URL ?? 'http://localhost:3001';
const PROXY     = `${WEB_BASE}/api/backend`;

// ─── 헬퍼: CORS 헤더 딕셔너리 검증 ──────────────────────────────────────────
function assertCorsHeaderMap(headers: Record<string, string>, context = '') {
  const origin = headers['access-control-allow-origin'];
  const creds  = headers['access-control-allow-credentials'];
  expect(origin, `${context} — Access-Control-Allow-Origin 누락`).toBeTruthy();
  if (creds === 'true') {
    expect(origin, `${context} — credentials:true 인데 origin:* (브라우저 차단됨)`).not.toBe('*');
  }
}

// Response (page.on 인터셉트 결과)
function assertCorsHeaders(response: Response, context = '') {
  assertCorsHeaderMap(response.headers(), context);
}

// APIResponse (page.request.* 결과)
function assertApiCorsHeaders(response: APIResponse, context = '') {
  assertCorsHeaderMap(response.headers(), context);
}

// ─── 1. CORS preflight (OPTIONS) 정상 응답 ───────────────────────────────────
test('COD-28-1: API CORS preflight 정상 응답', async ({ request }) => {
  const res = await request.fetch(`${API_BASE}/auth/otp/send`, {
    method: 'OPTIONS',
    headers: {
      Origin: WEB_BASE,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });

  // 204 or 200 허용
  expect(
    [200, 204].includes(res.status()),
    `OPTIONS 응답 상태 ${res.status()} (기대: 200 or 204)`,
  ).toBeTruthy();

  const headers = res.headers();
  expect(
    headers['access-control-allow-origin'],
    'Access-Control-Allow-Origin 헤더 누락',
  ).toBeTruthy();
  expect(
    headers['access-control-allow-methods'] || headers['allow'],
    'Allow 메서드 헤더 누락',
  ).toBeTruthy();
});

// ─── 2. OTP 로그인 → CORS 헤더 + 쿠키 검증 ──────────────────────────────────
test('COD-28-2: OTP 로그인 CORS 헤더 + httpOnly 쿠키', async ({ page }) => {
  let sendResponse: Response | null = null;
  let verifyResponse: Response | null = null;

  // 응답 인터셉트 (브라우저 레벨 네트워크)
  page.on('response', (res) => {
    if (res.url().includes('/auth/otp/send'))   sendResponse   = res;
    if (res.url().includes('/auth/otp/verify')) verifyResponse = res;
  });

  await loginAs(page, 'junkyard@evacycle.com');

  // 로그인 후 기본 페이지 확인
  await expect(page).toHaveURL(/\/cases/, { timeout: 12000 });
  await expect(page.locator('aside').first()).toBeVisible({ timeout: 8000 });

  // OTP send CORS 헤더 확인
  if (sendResponse) {
    assertCorsHeaders(sendResponse as Response, 'OTP send');
  }

  // OTP verify CORS 헤더 확인
  if (verifyResponse) {
    assertCorsHeaders(verifyResponse as Response, 'OTP verify');
  }

  // evacycle-session 쿠키 존재 확인 (middleware 통과 증거)
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name === 'evacycle-session');
  expect(sessionCookie, 'evacycle-session 쿠키 없음').toBeTruthy();

  // refreshToken은 httpOnly 쿠키 — JavaScript에서 접근 불가 검증
  const refreshFromJS = await page.evaluate(() => {
    return document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('refreshToken=') || c.startsWith('refresh_token='));
  });
  expect(
    refreshFromJS,
    'refreshToken이 JS 접근 가능한 쿠키에 노출됨 (httpOnly 설정 확인 필요)',
  ).toBeUndefined();
});

// ─── 3. 인증 토큰 메모리 저장 확인 ───────────────────────────────────────────
test('COD-28-3: accessToken 메모리 저장 (localStorage 미저장)', async ({ page }) => {
  await loginAs(page, 'junkyard@evacycle.com');
  await expect(page).toHaveURL(/\/cases/, { timeout: 12000 });

  // accessToken이 localStorage에 저장되어선 안 됨
  const tokenFromStorage = await page.evaluate(() => {
    // evacycle-auth persist 스토어 확인
    const raw = localStorage.getItem('evacycle-auth');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.accessToken ?? null;
    } catch {
      return null;
    }
  });

  expect(
    tokenFromStorage,
    `accessToken이 localStorage에 저장됨 (보안 위험): ${tokenFromStorage}`,
  ).toBeNull();

  // isAuthenticated는 true여야 함
  const isAuthenticated = await page.evaluate(() => {
    const raw = localStorage.getItem('evacycle-auth');
    if (!raw) return null;
    try {
      return JSON.parse(raw)?.state?.isAuthenticated ?? null;
    } catch { return null; }
  });
  expect(isAuthenticated, 'isAuthenticated가 false').toBe(true);
});

// ─── 4. API 요청 Authorization 헤더 포함 확인 ────────────────────────────────
test('COD-28-4: API 요청에 Authorization 헤더 포함', async ({ page }) => {
  const authHeaders: string[] = [];

  page.on('request', (req: Request) => {
    if (req.url().includes('/api/backend/') || req.url().includes('localhost:3000')) {
      const auth = req.headers()['authorization'];
      if (auth) authHeaders.push(req.url());
    }
  });

  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto('/cases');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // 케이스 목록 API 요청에 Authorization 헤더가 있어야 함
  expect(
    authHeaders.length,
    'Authorization 헤더가 포함된 API 요청 없음 — 인증 플로우 확인 필요',
  ).toBeGreaterThan(0);
});

// ─── 5. 케이스 등록 위저드 전체 플로우 + CORS 이상 없음 ──────────────────────
test('COD-28-5: 케이스 등록 위저드 CORS 에러 없음', async ({ page }) => {
  const corsErrors: string[] = [];
  const networkErrors: string[] = [];

  // 콘솔 에러 수집 (CORS 에러는 콘솔에 출력됨)
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.toLowerCase().includes('cors') ||
        text.toLowerCase().includes('access-control') ||
        text.toLowerCase().includes('blocked by cors')
      ) {
        corsErrors.push(text);
      }
    }
  });

  // 네트워크 오류 수집
  page.on('requestfailed', (req: Request) => {
    const failure = req.failure();
    if (failure?.errorText?.toLowerCase().includes('cors') ||
        failure?.errorText?.toLowerCase().includes('failed')) {
      networkErrors.push(`${req.url()} — ${failure?.errorText}`);
    }
  });

  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto('/cases/new');

  // Step 1 — wizard 대기
  await page.waitForSelector('[data-testid="wizard-step"][data-step="1"]', { timeout: 8000 });

  const vin = `KMH${Date.now().toString().slice(-12)}AB`.slice(0, 17);
  await page.getByLabel('제조사').fill('현대');
  await page.getByLabel('모델명').fill('코나EV');
  await page.getByLabel('연식').fill('2022');
  await page.getByLabel(/VIN/).fill(vin);

  // "다음" 클릭 — createCase API 호출
  await page.locator('[data-testid="step1-next"]').click();

  // Step 2 대기 (API 완료 후 렌더링)
  await page.waitForSelector('[data-testid="wizard-step"][data-step="2"]', { timeout: 15000 });

  // "건너뛰기" 클릭
  await page.locator('[data-testid="step2-skip"]').click();

  // Step 3 대기
  await page.waitForSelector('[data-testid="wizard-step"][data-step="3"]', { timeout: 10000 });

  // "케이스 제출" 클릭
  await page.locator('[data-testid="step3-submit"]').click();

  // 케이스 상세 페이지로 이동 확인
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}/, { timeout: 15000 });

  // CORS 에러 없어야 함
  expect(
    corsErrors,
    `케이스 등록 중 CORS 에러 발생:\n${corsErrors.join('\n')}`,
  ).toHaveLength(0);
});

// ─── 6. 파일 업로드 3단계 CORS 검증 (presign → MinIO → confirm) ──────────────
test('COD-28-6: 파일 업로드 presign CORS 헤더', async ({ page }) => {
  const corsErrors: string[] = [];
  const apiResponses: Array<{ url: string; status: number; cors: string }> = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().toLowerCase().includes('cors')) {
      corsErrors.push(msg.text());
    }
  });

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/files/presign') || url.includes('/api/minio')) {
      const cors = res.headers()['access-control-allow-origin'] ?? '(없음)';
      apiResponses.push({ url, status: res.status(), cors });
    }
  });

  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto('/cases/new');
  await page.waitForSelector('[data-testid="wizard-step"][data-step="1"]', { timeout: 8000 });

  const vin = `KMH${(Date.now() + 1).toString().slice(-12)}CD`.slice(0, 17);
  await page.getByLabel('제조사').fill('기아');
  await page.getByLabel('모델명').fill('EV6');
  await page.getByLabel('연식').fill('2023');
  await page.getByLabel(/VIN/).fill(vin);
  await page.locator('[data-testid="step1-next"]').click();

  // Step 2 — 파일 첨부 단계
  await page.waitForSelector('[data-testid="wizard-step"][data-step="2"]', { timeout: 15000 });

  // 작은 테스트용 파일 생성 후 업로드
  const testFileContent = 'EVACYCLE E2E TEST FILE';
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
    page.locator('input[type="file"]').click({ force: true }).catch(() => null),
  ]);

  if (fileChooser) {
    await fileChooser.setFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(testFileContent),
    });

    // 업로드 버튼으로 변경됨 — 업로드 진행
    const uploadBtn = page.locator('[data-testid="step2-upload"]');
    if (await uploadBtn.isVisible({ timeout: 3000 })) {
      await uploadBtn.click();
      // 업로드 완료 또는 에러 대기 (타임아웃은 허용)
      await page.waitForSelector(
        '[data-testid="wizard-step"][data-step="3"], [data-testid="wizard-step"][data-step="2"]',
        { timeout: 20000 },
      );
    }
  } else {
    // file input 없으면 건너뛰기
    await page.locator('[data-testid="step2-skip"]').click();
  }

  // presign 응답 CORS 헤더 확인
  const presignResponse = apiResponses.find((r) => r.url.includes('/files/presign'));
  if (presignResponse) {
    expect(
      presignResponse.cors,
      `presign API CORS 헤더 누락 (status: ${presignResponse.status})`,
    ).not.toBe('(없음)');
  }

  // 업로드 중 CORS 에러 없어야 함
  expect(
    corsErrors,
    `파일 업로드 중 CORS 에러:\n${corsErrors.join('\n')}`,
  ).toHaveLength(0);
});

// ─── 7. Token Refresh (silent refresh) CORS 검증 ─────────────────────────────
test('COD-28-7: Token Refresh 요청 CORS 정상', async ({ page }) => {
  const refreshResponses: Array<{ status: number; cors: string; creds: string }> = [];

  page.on('response', (res) => {
    if (res.url().includes('/auth/refresh') || res.url().includes('/auth/token/refresh')) {
      refreshResponses.push({
        status: res.status(),
        cors:   res.headers()['access-control-allow-origin'] ?? '(없음)',
        creds:  res.headers()['access-control-allow-credentials'] ?? '(없음)',
      });
    }
  });

  await loginAs(page, 'junkyard@evacycle.com');

  // refresh 직접 호출 (프록시 경유)
  const refreshRes = await page.request.post(`${PROXY}/auth/refresh`, {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  });

  // refresh 응답 확인 (401은 쿠키 없어서 정상, 200/201은 성공)
  expect(
    [200, 201, 401, 403].includes(refreshRes.status()),
    `예상치 못한 refresh 상태 코드: ${refreshRes.status()}`,
  ).toBeTruthy();

  // CORS 헤더 확인
  const corsHeader = refreshRes.headers()['access-control-allow-origin'];
  // 응답에 CORS 헤더가 있으면 * 이 아닌 명시적 origin이어야 함 (credentials 요청)
  if (corsHeader && corsHeader !== '(없음)') {
    const credHeader = refreshRes.headers()['access-control-allow-credentials'];
    if (credHeader === 'true') {
      expect(corsHeader).not.toBe('*');
    }
  }
});

// ─── 8. 관리자 API CORS 검증 ─────────────────────────────────────────────────
test('COD-28-8: 관리자 API CORS + 인증 헤더', async ({ page }) => {
  const apiErrors: string[] = [];

  page.on('response', (res) => {
    if (res.url().includes('/admin/') && res.status() >= 400) {
      apiErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  await loginAs(page, 'admin@evacycle.com');
  await expect(page).toHaveURL(/\/admin/, { timeout: 12000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // 관리자 대시보드 API 정상 응답 확인
  const token = await getAccessToken('admin@evacycle.com');
  const dashRes = await page.request.get(`${API_BASE}/admin/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: WEB_BASE,
    },
  });

  expect(
    dashRes.status(),
    `관리자 대시보드 API 실패: ${dashRes.status()}`,
  ).toBe(200);

  // CORS 헤더
  assertApiCorsHeaders(dashRes, '관리자 dashboard API');

  // 콘텐츠 확인
  const body = await dashRes.json();
  expect(body.cases ?? body.data ?? body, '대시보드 응답 비어있음').toBeTruthy();
});

// ─── 9. 전체 플로우 요약 — CORS/쿠키/인증 이상 없음 ─────────────────────────
test('COD-28-9: 전체 플로우 CORS/쿠키/인증 종합 검증', async ({ page }) => {
  const allCorsErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('CORS') || text.includes('Access-Control') || text.includes('blocked')) {
        allCorsErrors.push(text);
      }
    }
  });

  page.on('requestfailed', (req: Request) => {
    const url = req.url();
    // MinIO 및 API 요청 실패만 기록
    if (url.includes('localhost:3000') || url.includes('localhost:9000') || url.includes('/api/')) {
      failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`);
    }
  });

  // 폐차장 플로우
  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto('/cases');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // 허브 플로우
  await loginAs(page, 'hub@evacycle.com');
  await page.goto('/lots');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // 바이어 플로우
  await loginAs(page, 'buyer@evacycle.com');
  await page.goto('/marketplace');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // 관리자 플로우
  await loginAs(page, 'admin@evacycle.com');
  await page.goto('/admin');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // CORS 에러 없어야 함
  expect(
    allCorsErrors,
    `전체 플로우 중 CORS 에러 발생:\n${allCorsErrors.join('\n')}`,
  ).toHaveLength(0);

  // 치명적 네트워크 실패 없어야 함
  expect(
    failedRequests.filter((r) => !r.includes('favicon')),
    `네트워크 요청 실패:\n${failedRequests.join('\n')}`,
  ).toHaveLength(0);

  console.log('✅ 전체 플로우 CORS/쿠키/인증 이상 없음');
});
