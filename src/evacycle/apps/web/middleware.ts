import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/lib/store/auth';

/**
 * 미들웨어 인증 방식:
 * - accessToken은 메모리 only (XSS 방어) → 미들웨어에서 토큰 검증 불가
 * - 대신 로그인 시 auth store가 설정한 `evacycle-session` 쿠키를 확인
 *   쿠키 내용: { isAuthenticated: true, role: UserRole } — 토큰 없음
 * - 실제 API 권한 검증은 서버(NestJS JWT Guard)가 담당
 */

const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  ADMIN:           ['/admin', '/lots', '/cases', '/marketplace'],
  HUB:             ['/lots', '/cases'],
  JUNKYARD:        ['/cases', '/settlements'],
  INTAKE_JUNKYARD: ['/cases', '/settlements'],
  OWNER:           ['/cases', '/settlements'],
  BUYER:           ['/marketplace'],
};

function getRoleHome(role: UserRole): string {
  switch (role) {
    case 'ADMIN':           return '/admin';
    case 'HUB':             return '/lots';
    case 'JUNKYARD':
    case 'INTAKE_JUNKYARD':
    case 'OWNER':           return '/cases';
    case 'BUYER':           return '/marketplace';
    default:                return '/';
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로 — 인증 불필요
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // ✅ evacycle-session 쿠키 파싱 (토큰 없음, role만 포함)
  const raw = request.cookies.get('evacycle-session')?.value;

  if (!raw) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let session: { isAuthenticated?: boolean; role?: string } | null = null;

  try {
    session = JSON.parse(decodeURIComponent(raw));
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!session?.isAuthenticated || !session.role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = session.role as UserRole;

  // 루트 → 역할별 홈
  if (pathname === '/') {
    return NextResponse.redirect(new URL(getRoleHome(role), request.url));
  }

  // 역할 기반 경로 접근 제어
  const allowedPaths = ROLE_ALLOWED_PATHS[role] ?? [];
  const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));

  if (!isAllowed) {
    return NextResponse.redirect(new URL(getRoleHome(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
};
