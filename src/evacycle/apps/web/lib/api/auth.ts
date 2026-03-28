import apiClient from './client';
import { AuthUser } from '@/lib/store/auth';

export interface SendOtpRequest {
  email: string;
}

export interface SendOtpResponse {
  message: string;
  expiresIn: number;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  // refreshToken은 httpOnly 쿠키로 발급 — 응답 바디에 없음
  user: AuthUser;
}

/** OTP 발송 */
export async function sendOtp(email: string): Promise<SendOtpResponse> {
  const { data } = await apiClient.post<SendOtpResponse>('/auth/otp/send', {
    email,
  });
  return data;
}

/** OTP 검증 + 토큰 발급 */
export async function verifyOtp(
  email: string,
  otp: string,
): Promise<VerifyOtpResponse> {
  const { data } = await apiClient.post<VerifyOtpResponse>(
    '/auth/otp/verify',
    { email, otp },
  );
  return data;
}

/** 토큰 갱신 (refreshToken은 httpOnly 쿠키로 자동 전송) */
export async function refreshTokenApi(): Promise<{ accessToken: string }> {
  const { data } = await apiClient.post('/auth/token/refresh', {});
  return data;
}

/** 로그아웃 (쿠키 삭제 + Redis 무효화) */
export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}
