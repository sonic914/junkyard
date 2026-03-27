'use client';

import { Bell } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title?: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '관리자',
  OWNER: '오너',
  JUNKYARD: '폐차장',
  INTAKE_JUNKYARD: '입고담당',
  HUB: '허브센터',
  BUYER: '구매자',
};

export function Header({ title }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        {title && <h1 className="text-lg font-semibold">{title}</h1>}
      </div>

      <div className="flex items-center gap-3">
        {/* 알림 버튼 */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>

        {/* 사용자 정보 */}
        {user && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
            <span className="text-sm font-medium">{user.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
