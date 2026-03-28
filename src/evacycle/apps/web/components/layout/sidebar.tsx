'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Package,
  ShoppingCart,
  LogOut,
  Building2,
  Users,
  SlidersHorizontal,
  BookOpen,
  ClipboardList,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/lib/store/auth';
import { logoutApi } from '@/lib/api/auth';
import { Skeleton } from '@/components/ui/skeleton';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  // ── ADMIN 전용 ────────────────────────────────────────────────────────────
  {
    label: '대시보드',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN'],
  },
  {
    label: '케이스 관리',
    href: '/admin/cases',
    icon: FileText,
    roles: ['ADMIN'],
  },
  {
    label: '정산 관리',
    href: '/admin/settlements',
    icon: Wallet,
    roles: ['ADMIN'],
  },
  {
    label: '조직 관리',
    href: '/admin/organizations',
    icon: Building2,
    roles: ['ADMIN'],
  },
  {
    label: '사용자 관리',
    href: '/admin/users',
    icon: Users,
    roles: ['ADMIN'],
  },
  {
    label: '룰 관리',
    href: '/admin/rules',
    icon: SlidersHorizontal,
    roles: ['ADMIN'],
  },
  {
    label: '이벤트 원장',
    href: '/admin/ledger',
    icon: BookOpen,
    roles: ['ADMIN'],
  },

  // ── HUB 전용 ─────────────────────────────────────────────────────────────
  {
    label: '입고 관리',
    href: '/lots',
    icon: Package,
    roles: ['HUB'],
  },

  // ── JUNKYARD / OWNER / INTAKE_JUNKYARD ───────────────────────────────────
  {
    label: '케이스 관리',
    href: '/cases',
    icon: FileText,
    roles: ['JUNKYARD', 'INTAKE_JUNKYARD', 'OWNER'],
  },
  {
    label: '정산 내역',
    href: '/settlements',
    icon: Wallet,
    roles: ['JUNKYARD', 'INTAKE_JUNKYARD', 'OWNER'],
  },

  // ── BUYER 전용 ────────────────────────────────────────────────────────────
  {
    label: '마켓플레이스',
    href: '/marketplace',
    icon: ShoppingCart,
    roles: ['BUYER'],
  },
  {
    label: '구매 내역',
    href: '/marketplace/orders',
    icon: ClipboardList,
    roles: ['BUYER'],
  },
];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:           '관리자',
  OWNER:           '오너',
  JUNKYARD:        '폐차장',
  INTAKE_JUNKYARD: '입고담당',
  HUB:             '허브센터',
  BUYER:           '구매자',
};

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const role = user?.role as UserRole | undefined;

  // ── 하이드레이션 가드 ──────────────────────────────────────────────────────
  // zustand persist는 첫 렌더에서 기본값(null)을 사용하고 비동기로 hydration.
  // mounted 이전에 렌더하면 사이드바가 빈 채로 보임.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => role && item.roles.includes(role),
  );

  async function handleLogout() {
    try {
      await logoutApi();
    } catch {
      // ignore — 로컬 상태는 항상 초기화
    }
    logout();
    router.push('/login');
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* 로고 */}
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-xl font-bold text-primary">EVACYCLE</span>
      </div>

      {/* 사용자 정보 */}
      <div className="border-b px-6 py-4">
        {!mounted ? (
          <>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </>
        ) : user ? (
          <>
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">로그인 정보 없음</p>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {!mounted ? (
          // 하이드레이션 전: 스켈레톤
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mx-0 h-9 w-full rounded-md" />
          ))
        ) : visibleItems.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">
            메뉴를 불러오는 중...
          </p>
        ) : (
          visibleItems.map((item) => {
            const Icon = item.icon;
            // 활성 여부: 정확한 경로 일치 or 하위 경로
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href + '/'));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })
        )}
      </nav>

      {/* 로그아웃 */}
      <div className="border-t px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
