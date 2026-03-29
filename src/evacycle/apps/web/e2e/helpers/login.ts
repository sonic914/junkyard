import { Page } from '@playwright/test';

const PROXY = 'http://localhost:3001/api/backend';
const API_DIRECT = process.env.API_URL ?? 'http://localhost:3000/v1';

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: '/admin',
  JUNKYARD: '/cases',
  HUB: '/lots',
  BUYER: '/marketplace',
};

/**
 * OTP 로그인 헬퍼 — addInitScript 방식
 * 1. 프록시 경유 OTP send/verify → accessToken + user 획득
 * 2. addInitScript로 window.__E2E_AUTH__ 설정 (이후 모든 페이지 로드에 적용)
 * 3. evacycle-session 쿠키 설정 → middleware 통과
 * 4. 역할별 대시보드로 이동 (auth store가 __E2E_AUTH__에서 accessToken 자동 읽음)
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // 1단계: OTP 발송
  const sendRes = await page.request.post(`${PROXY}/auth/otp/send`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email },
  });
  const sendData = await sendRes.json();
  const otp: string = sendData.otp;
  if (!otp) throw new Error(`OTP 없음 (email: ${email})`);

  // 2단계: OTP 검증
  const verifyRes = await page.request.post(`${PROXY}/auth/otp/verify`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email, otp },
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.accessToken) throw new Error(`accessToken 없음: ${JSON.stringify(verifyData)}`);

  const { accessToken, user } = verifyData;

  // 3단계: addInitScript로 모든 페이지 로드 전에 __E2E_AUTH__ 주입
  await page.addInitScript((authData) => {
    (window as any).__E2E_AUTH__ = authData;
  }, { accessToken, user });

  // 4단계: evacycle-session 쿠키 설정 → middleware 통과
  await page.context().addCookies([
    {
      name: 'evacycle-session',
      value: encodeURIComponent(JSON.stringify({ isAuthenticated: true, role: user.role })),
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);

  // 5단계: 역할별 대시보드로 이동
  const redirect = ROLE_REDIRECT[user.role as string] ?? '/';
  await page.goto(redirect);
  await page.waitForURL(new RegExp(redirect.replace('/', '\\/')), { timeout: 15000 });
}

/**
 * API 직접 호출용 accessToken 획득
 */
export async function getAccessToken(email: string): Promise<string> {
  const sendRes = await fetch(`${API_DIRECT}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const sendData = await sendRes.json();
  const otp: string = sendData.otp;
  if (!otp) throw new Error(`OTP 없음`);

  const verifyRes = await fetch(`${API_DIRECT}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.accessToken) throw new Error(`accessToken 없음`);
  return verifyData.accessToken;
}
