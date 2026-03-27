import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/lib/store/auth';

/** 역할별 허용 경로 prefix */
const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  ADMIN: ['/admin', '/lots', '/cases', '/marketplace'],
  HUB: ['/lots', '/cases'],
  JUNKYARD: ['/cases'],
  INTAKE_JUNKYARD: ['/cases'],
  OWNER: ['/cases'],
  BUYER: ['/marketplace'],
};

/** 역할별 기본 리다이렉트 경로 */
function getRoleHome(role: UserRole): string {
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 인증 페이지는 통과
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 쿠키에서 auth 스토어 파싱 (zustand persist)
  const authCookie = request.cookies.get('evacycle-auth')?.value;

  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let authState: {
    state?: { accessToken?: string; user?: { role?: string } };
  } | null = null;

  try {
    authState = JSON.parse(authCookie);
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = authState?.state?.accessToken;
  const role = authState?.state?.user?.role as UserRole | undefined;

  // 토큰 없으면 로그인 리다이렉트
  if (!token || !role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 루트 경로 → 역할별 홈으로
  if (pathname === '/') {
    return NextResponse.redirect(new URL(getRoleHome(role), request.url));
  }

  // 역할 기반 접근 제어
  const allowedPaths = ROLE_ALLOWED_PATHS[role] ?? [];
  const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));

  if (!isAllowed) {
    return NextResponse.redirect(new URL(getRoleHome(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};
