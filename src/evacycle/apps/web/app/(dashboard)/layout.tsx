'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

/**
 * 경로 기반 테마 분기
 * - /admin, /lots  → theme-b (인디고 #1E40AF)
 * - /cases, /marketplace, /settlements → theme-a (딥그린 #1A6B3C)
 */
function resolveTheme(pathname: string): 'a' | 'b' {
  if (pathname.startsWith('/admin') || pathname.startsWith('/lots')) {
    return 'b';
  }
  return 'a';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const theme = resolveTheme(pathname);

  return (
    // data-theme을 최상위 레이아웃에 적용 → Sidebar/Header/Main 전체에 테마 전파
    <div className="flex h-screen overflow-hidden" data-theme={theme}>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
