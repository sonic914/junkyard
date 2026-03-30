import { Page } from '@playwright/test';

const PROXY = 'http://localhost:3001/api/backend';

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN:            '/admin',
  JUNKYARD:         '/cases',
  INTAKE_JUNKYARD:  '/cases',
  OWNER:            '/cases',
  HUB:              '/lots',
  BUYER:            '/marketplace',
};

/**
 * OTP 로그인 헬퍼 — addInitScript + localStorage 이중 주입
 *
 * 문제 해결:
 * 1. addInitScript: window.__E2E_AUTH__ 설정 (React 앱이 읽음)
 * 2. addInitScript: evacycle-auth localStorage 직접 설정
 *    → zustand/persist hydration 시 __E2E_AUTH__ 값이 localStorage로 덮어씌워지는 버그 방지
 * 3. evacycle-session 쿠키: middleware 통과용
 * 4. SilentRefreshProvider: __E2E_AUTH__ 감지 시 refresh 스킵 (providers.tsx)
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // 1단계: OTP 발송
  const sendRes = await page.request.post(`${PROXY}/auth/otp/send`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email },
  });
  if (!sendRes.ok()) {
    throw new Error(`OTP 발송 실패 (${sendRes.status()}): ${await sendRes.text()}`);
  }
  const sendData = await sendRes.json();
  const otp: string = sendData.otp;
  if (!otp) throw new Error(`OTP 필드 없음 (NODE_ENV=development 확인): ${JSON.stringify(sendData)}`);

  // 2단계: OTP 검증
  const verifyRes = await page.request.post(`${PROXY}/auth/otp/verify`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email, otp },
  });
  if (!verifyRes.ok()) {
    throw new Error(`OTP 검증 실패 (${verifyRes.status()}): ${await verifyRes.text()}`);
  }
  const verifyData = await verifyRes.json();
  if (!verifyData.accessToken) throw new Error(`accessToken 없음: ${JSON.stringify(verifyData)}`);

  const { accessToken, user } = verifyData;

  // 3단계: addInitScript — 모든 페이지 로드 전에 실행
  await page.addInitScript((authData) => {
    // a) __E2E_AUTH__ 설정 (React 초기 상태에서 읽힘)
    (window as any).__E2E_AUTH__ = authData;

    // b) evacycle-auth localStorage 직접 설정
    //    → zustand/persist hydration 시 isAuthenticated/user 복원
    try {
      const persistState = JSON.stringify({
        state: {
          user:            authData.user,
          isAuthenticated: true,
          accessToken:     null,  // accessToken은 메모리만 — persist 제외
          refreshToken:    null,
        },
        version: 0,
      });
      localStorage.setItem('evacycle-auth', persistState);
    } catch (_) {/* private browsing 등 예외 무시 */}
  }, { accessToken, user });

  // 4단계: evacycle-session 쿠키 설정 (middleware 통과용)
  await page.context().addCookies([
    {
      name:     'evacycle-session',
      value:    encodeURIComponent(JSON.stringify({ isAuthenticated: true, role: user.role })),
      domain:   'localhost',
      path:     '/',
      sameSite: 'Lax',
    },
  ]);

  // 5단계: 역할별 대시보드로 이동
  const redirect = ROLE_REDIRECT[user.role as string] ?? '/';
  await page.goto(redirect);

  // 6단계: networkidle 대기 → aside 렌더링 확인 (hydration 완료)
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await page.waitForSelector('aside', { timeout: 12000 });
}

/**
 * API 직접 호출용 accessToken 획득 (UI 없이 백엔드 조작 단계에 사용)
 */
export async function getAccessToken(email: string): Promise<string> {
  const API = process.env.API_URL ?? 'http://localhost:3000/v1';

  const sendRes = await fetch(`${API}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const sendData = await sendRes.json();
  if (!sendData.otp) throw new Error(`OTP 없음 (email: ${email})`);

  const verifyRes = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: sendData.otp }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.accessToken) throw new Error(`accessToken 없음 (email: ${email})`);
  return verifyData.accessToken;
}
