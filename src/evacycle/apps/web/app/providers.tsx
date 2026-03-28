'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/lib/store/auth';

/**
 * Silent Refresh — 앱 초기화 시 실행
 * - isAuthenticated가 true이면 (localStorage 복원) refreshToken 쿠키로 accessToken 재발급
 * - 쿠키 없거나 만료 시 → logout (로그인 화면)
 */
function SilentRefreshProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { isAuthenticated, setTokens, logout } = useAuthStore.getState();
    if (!isAuthenticated) return;

    const BASE =
      typeof window === 'undefined'
        ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000') + '/v1'
        : '/api/backend';

    axios
      .post(`${BASE}/auth/token/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setTokens(data.accessToken, '');
      })
      .catch(() => {
        // 쿠키 만료 or 없음 → 재로그인 필요
        logout();
      });
  }, []);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SilentRefreshProvider>{children}</SilentRefreshProvider>
    </QueryClientProvider>
  );
}
