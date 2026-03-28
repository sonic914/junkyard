import { Page } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:3000/v1';

/**
 * UI 기반 OTP 로그인 헬퍼
 * 1. fetch로 OTP 발송 → dev 모드 응답에서 otp 추출
 * 2. 로그인 페이지를 통해 브라우저 세션 수립
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // 1. OTP 발송
  const sendRes = await fetch(`${API}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const sendData = await sendRes.json();
  const otp: string = sendData.otp;

  if (!otp) {
    throw new Error(
      `OTP 응답에 otp 필드 없음. NODE_ENV=development + 서버 실행 확인 필요.\n응답: ${JSON.stringify(sendData)}`,
    );
  }

  // 2. 로그인 페이지 이동
  await page.goto('/login');
  await page.waitForSelector('input[type="email"], input[placeholder*="이메일"]', { timeout: 8000 });

  // 3. 이메일 입력 + OTP 발송 버튼
  const emailInput = page.locator('input[type="email"]').or(
    page.locator('input[placeholder*="이메일"]')
  ).first();
  await emailInput.fill(email);
  await page.getByRole('button', { name: /OTP 발송|발송|전송/i }).click();

  // 4. OTP 입력 화면 대기 (입력 필드 변경)
  await page.waitForSelector(
    'input[placeholder*="OTP"], input[placeholder*="코드"], input[type="text"]',
    { timeout: 8000 }
  );

  // 5. OTP 6자리 입력
  const otpInput = page.locator('input[placeholder*="OTP"]').or(
    page.locator('input[placeholder*="코드"]')
  ).or(
    page.locator('input[inputmode="numeric"]')
  ).first();
  await otpInput.fill(otp);

  // 6. 확인/로그인 버튼
  await page.getByRole('button', { name: /로그인|확인|인증/i }).click();

  // 7. 대시보드 진입 확인
  await page.waitForURL(/\/(admin|cases|lots|marketplace|settlements)/, {
    timeout: 10000,
  });
}

/**
 * API 직접 호출용 accessToken 획득 (UI 없이 백엔드 조작 단계에 사용)
 */
export async function getAccessToken(email: string): Promise<string> {
  const sendRes = await fetch(`${API}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const sendData = await sendRes.json();
  if (!sendData.otp) throw new Error(`OTP 응답 없음: ${JSON.stringify(sendData)}`);

  const verifyRes = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: sendData.otp }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.accessToken) throw new Error(`토큰 발급 실패: ${JSON.stringify(verifyData)}`);

  return verifyData.accessToken;
}
