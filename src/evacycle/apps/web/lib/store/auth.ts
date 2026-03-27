import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'evacycle-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
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
