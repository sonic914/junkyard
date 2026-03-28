import { Page, expect } from '@playwright/test';
import axios from 'axios';

const API = process.env.API_URL ?? 'http://localhost:3000/v1';

/**
 * OTP 로그인 헬퍼
 * 1. POST /auth/otp/send → dev 모드에서 응답에 otp 포함
 * 2. POST /auth/otp/verify → accessToken + httpOnly 쿠키 발급
 * 3. Next.js 로그인 페이지를 통한 브라우저 세션 수립
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  // 1. OTP 발송 (API 직접 호출로 otp 추출)
  const sendRes = await axios.post(`${API}/auth/otp/send`, { email });
  const otp: string = sendRes.data.otp;

  if (!otp) {
    throw new Error(
      `OTP 응답에 otp 필드 없음. NODE_ENV=development 서버에서만 동작합니다.`,
    );
  }

  // 2. 로그인 페이지 이동
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /로그인/i })).toBeVisible();

  // 3. 이메일 입력 + OTP 발송 버튼
  await page.getByPlaceholder(/이메일/i).fill(email);
  await page.getByRole('button', { name: /OTP 발송/i }).click();

  // 4. OTP 입력 화면 대기
  await expect(page.getByPlaceholder(/OTP/i)).toBeVisible({ timeout: 5000 });

  // 5. OTP 입력 + 로그인 버튼
  await page.getByPlaceholder(/OTP/i).fill(otp);
  await page.getByRole('button', { name: /로그인|확인/i }).click();

  // 6. 대시보드 진입 확인
  await page.waitForURL(/\/(admin|cases|lots|marketplace)/, { timeout: 8000 });
}

/**
 * API 직접 호출용 accessToken 획득
 * (UI 없이 백엔드를 직접 호출하는 step에서 사용)
 */
export async function getAccessToken(email: string): Promise<string> {
  const sendRes = await axios.post(`${API}/auth/otp/send`, { email });
  const otp: string = sendRes.data.otp;
  if (!otp) throw new Error('OTP 응답 없음');

  const verifyRes = await axios.post(`${API}/auth/otp/verify`, { email, otp });
  return verifyRes.data.accessToken;
}
