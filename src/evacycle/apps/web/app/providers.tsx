'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/lib/store/auth';

/**
 * Silent Refresh Provider — 앱 초기화 시 자동 토큰 복원
 *
 * 흐름:
 * 1. localStorage에 isAuthenticated=true 저장된 경우 → refresh 시도
 * 2. refreshToken httpOnly 쿠키로 새 accessToken 발급
 * 3. 성공: accessToken 메모리 복원 + 세션 쿠키(middleware용) 갱신
 * 4. 실패: logout (로그인 화면)
 *
 * COD-17/24 fix: refresh 성공 후 session 쿠키도 갱신 (30분 만료 방지)
 */
function SilentRefreshProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // E2E 테스트 모드: __E2E_AUTH__ 주입된 경우 refresh 스킵
    // (실제 refreshToken 쿠키 없으므로 refresh 실패 → logout 방지)
    if (typeof window !== 'undefined' && (window as any).__E2E_AUTH__?.accessToken) return;

    const store = useAuthStore.getState();
    const { isAuthenticated, setTokens, logout, user } = store;
    if (!isAuthenticated) return;

    const BASE = '/api/backend';

    axios
      .post(`${BASE}/auth/token/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setTokens(data.accessToken, '');
        // 세션 쿠키 갱신 (middleware 통과용) — user는 persist에서 복원됨
        if (user?.role) {
          const value = encodeURIComponent(
            JSON.stringify({ isAuthenticated: true, role: user.role }),
          );
          document.cookie = `evacycle-session=${value}; path=/; max-age=1800; SameSite=Strict`;
        }
      })
      .catch(() => {
        // refreshToken 만료 or 없음 → 재로그인
        logout();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SilentRefreshProvider>{children}</SilentRefreshProvider>
    </QueryClientProvider>
  );
}
