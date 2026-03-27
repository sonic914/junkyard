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
  refreshToken: string;
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

/** 토큰 갱신 */
export async function refreshTokenApi(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { data } = await apiClient.post('/auth/token/refresh', {
    refreshToken,
  });
  return data;
}

/** 로그아웃 */
export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}
