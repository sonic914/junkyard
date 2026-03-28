import { Page } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:3000/v1';

/**
 * OTP 로그인 헬퍼
 * - UI에서 "OTP 받기" 클릭 → 응답을 인터셉트해서 OTP 추출
 * - 기존 방식(API 먼저 호출)은 UI 클릭 시 새 OTP 발급으로 무효화됨
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/login');

  // 1. OTP 응답 인터셉트
  let capturedOtp: string | null = null;
  page.on('response', async (res) => {
    if (res.url().includes('/auth/otp/send') && res.ok()) {
      try {
        const body = await res.json();
        if (body.otp) capturedOtp = body.otp;
      } catch {}
    }
  });

  // 2. 이메일 입력 + OTP 발송
  const emailInput = page.locator('input[type="email"]')
    .or(page.locator('input[placeholder*="이메일"]'))
    .or(page.locator('input[name="email"]'))
    .first();
  await emailInput.fill(email);
  await page.getByRole('button', { name: /OTP 받기/i }).click();

  // 3. OTP 캡처 대기 (최대 5초)
  for (let i = 0; i < 50; i++) {
    if (capturedOtp) break;
    await page.waitForTimeout(100);
  }
  if (!capturedOtp) throw new Error(`OTP 캡처 실패 (email: ${email})`);

  // 4. OTP 6칸 입력 (pressSequentially → React onChange 트리거)
  const digits = capturedOtp.split('');
  const inputs = page.locator('input[maxlength="1"]');
  await inputs.first().click();
  for (let i = 0; i < 6; i++) {
    await inputs.nth(i).click();
    await inputs.nth(i).pressSequentially(digits[i], { delay: 80 });
    await page.waitForTimeout(60);
  }

  // 5. 자동 제출 + 대시보드 진입 대기
  await page.waitForTimeout(800);
  await page.waitForURL(/\/(admin|cases|lots|marketplace|settlements)/, {
    timeout: 15000,
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
  const otp: string = sendData.otp;
  if (!otp) throw new Error(`OTP 응답 없음 (email: ${email})`);

  const verifyRes = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.accessToken) throw new Error(`accessToken 없음 (email: ${email})`);
  return verifyData.accessToken;
}
