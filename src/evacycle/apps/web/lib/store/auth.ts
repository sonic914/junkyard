import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '@/lib/query-client';

export type UserRole =
  | 'ADMIN'
  | 'OWNER'
  | 'JUNKYARD'
  | 'INTAKE_JUNKYARD'
  | 'HUB'
  | 'BUYER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
}

interface AuthState {
  // ✅ 토큰은 메모리에만 — localStorage/쿠키 저장 금지
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

// ─── 미들웨어용 세션 쿠키 (토큰 없음, role만) ────────────────────────────────
// httpOnly 불가(클라이언트 JS에서 설정)이므로 민감 정보 절대 포함 금지
function setSessionCookie(role: UserRole): void {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify({ isAuthenticated: true, role }));
  // SameSite=Strict + Secure(prod) — 30분 유효
  document.cookie = `evacycle-session=${value}; path=/; max-age=1800; SameSite=Strict`;
}

function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = 'evacycle-session=; path=/; max-age=0; SameSite=Strict';
}

// ─── Store ───────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      setUser: (user) => {
        set({ user });
        // 로그인 직후 user 세팅 시 세션 쿠키 발급
        setSessionCookie(user.role);
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
        clearSessionCookie();
        // React Query 캐시 전체 초기화 — 다른 사용자 데이터 노출 방지
        queryClient.clear();
      },
    }),
    {
      name: 'evacycle-auth',
      // ✅ Critical fix: 토큰을 localStorage에서 제거
      // user + isAuthenticated만 persist → 새로고침 후 UI 상태 복원용
      // 실제 API 인증은 메모리 토큰 사용, 만료 시 재로그인 필요
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // accessToken: 제거 (메모리 only)
        // refreshToken: 제거 (메모리 only)
      }),
    },
  ),
);

/** 역할별 기본 리다이렉트 경로 */
export function getRoleRedirectPath(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'HUB':
      return '/lots';
    case 'JUNKYARD':
    case 'INTAKE_JUNKYARD':
    case 'OWNER':
      return '/cases';
    case 'BUYER':
      return '/marketplace';
    default:
      return '/';
  }
}
