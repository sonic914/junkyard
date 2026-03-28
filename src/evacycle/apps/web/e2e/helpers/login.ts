import { Page } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:3000/v1';

/**
 * UI 기반 OTP 로그인 헬퍼
 *
 * 로그인 페이지 동작:
 *   - 이메일 입력 → "OTP 받기" 버튼 클릭
 *   - OTP 6칸 개별 input[maxlength="1"] 에 한 자리씩 입력
 *   - 6자리 완성 시 자동 제출 (submit 버튼 없음)
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // 1. API로 OTP 발송 + 코드 추출 (dev 모드)
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

  // 3. 이메일 입력
  await page.locator('input[type="email"]').fill(email);

  // 4. "OTP 받기" 버튼 클릭 (로딩 중엔 "발송 중...")
  await page.getByRole('button', { name: /OTP 받기/i }).click();

  // 5. OTP 6칸 digit input 대기
  await page.waitForSelector('input[maxlength="1"]', { timeout: 8000 });

  // 6. 각 칸에 한 자리씩 입력 (6번째 입력 시 자동 제출)
  const digits = otp.split('');
  const inputs = page.locator('input[maxlength="1"]');
  for (let i = 0; i < 6; i++) {
    await inputs.nth(i).fill(digits[i]);
    // 마지막 칸이 아닌 경우 다음 칸으로 포커스 이동 대기
    if (i < 5) {
      await page.waitForTimeout(50);
    }
  }

  // 7. 자동 제출 후 대시보드 진입 확인
  await page.waitForURL(/\/(admin|cases|lots|marketplace|settlements)/, {
    timeout: 12000,
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
  if (!verifyData.accessToken) {
    throw new Error(`토큰 발급 실패: ${JSON.stringify(verifyData)}`);
  }

  return verifyData.accessToken;
}
