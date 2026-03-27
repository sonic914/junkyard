'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/lib/store/auth';
import { logoutApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: '대시보드',
    href: '/admin',
    icon: LayoutDashboard,
    roles: ['ADMIN'],
  },
  {
    label: '케이스 관리',
    href: '/cases',
    icon: FileText,
    roles: ['ADMIN', 'OWNER', 'JUNKYARD', 'INTAKE_JUNKYARD', 'HUB'],
  },
  {
    label: 'Lot 관리',
    href: '/lots',
    icon: Package,
    roles: ['ADMIN', 'HUB'],
  },
  {
    label: '마켓플레이스',
    href: '/marketplace',
    icon: ShoppingCart,
    roles: ['ADMIN', 'BUYER'],
  },
  {
    label: '설정',
    href: '/settings',
    icon: Settings,
    roles: ['ADMIN'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const role = user?.role as UserRole | undefined;

  const visibleItems = NAV_ITEMS.filter(
    (item) => role && item.roles.includes(role),
  );

  async function handleLogout() {
    try {
      await logoutApi();
    } catch {
      // ignore
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
      {user && (
        <div className="border-b px-6 py-4">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.role}</p>
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
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
