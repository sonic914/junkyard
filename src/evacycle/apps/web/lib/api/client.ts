import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/lib/store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const REFRESH_URL = '/auth/token/refresh';

// 브라우저: Next.js rewrites 프록시 경유 → CORS 우회
// 서버(SSR/미들웨어): 백엔드 직접 호출
const BASE_URL =
  typeof window === 'undefined' ? `${API_URL}/v1` : '/api/backend';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
  withCredentials: true, // httpOnly refreshToken 쿠키 자동 전송
});

// ─── Request 인터셉터: 메모리 토큰 자동 주입 ─────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response 인터셉터: 401 → 토큰 갱신 → 재시도 ─────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processPendingQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // ✅ Medium fix: refresh 요청 자체가 401 → 무한루프 방지, 즉시 로그아웃
    if (originalRequest.url?.includes(REFRESH_URL)) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const { setTokens, logout } = useAuthStore.getState();
    // refreshToken은 httpOnly 쿠키에 있으므로 별도 확인 불필요

    // 동시 다발 401 — 큐잉 처리
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // refreshToken은 httpOnly 쿠키로 자동 전송 — body 불필요
      const { data } = await axios.post(`${BASE_URL}${REFRESH_URL}`, {}, {
        withCredentials: true,
      });
      const { accessToken } = data;
      setTokens(accessToken, '');
      processPendingQueue(null, accessToken);
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processPendingQueue(refreshError, null);
      logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;
