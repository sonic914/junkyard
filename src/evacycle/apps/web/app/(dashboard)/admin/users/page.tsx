'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, updateUserRole } from '@/lib/api/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/common/pagination';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, Save } from 'lucide-react';
import type { User, UserRole } from '@/types';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'OWNER', label: 'OWNER' },
  { value: 'JUNKYARD', label: 'JUNKYARD' },
  { value: 'INTAKE_JUNKYARD', label: 'INTAKE_JUNKYARD' },
  { value: 'HUB', label: 'HUB' },
  { value: 'BUYER', label: 'BUYER' },
];

const LIMIT = 20;

// ─── 역할 수정 인라인 컴포넌트 ────────────────────────────────────────────────
function RoleEditor({ user }: { user: User }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<UserRole>(user.role);
  const isDirty = role !== user.role;

  const mut = useMutation({
    mutationFn: () => updateUserRole(user.id, role),
    onSuccess: () => {
      toast({ title: `${user.name} 역할 변경 완료 → ${role}` });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: () => toast({ variant: 'destructive', title: '역할 변경 실패' }),
  });

  return (
    <div className="flex items-center gap-2">
      <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isDirty && (
        <Button
          size="icon"
          className="h-8 w-8"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { page, search }],
    queryFn: () =>
      getAdminUsers({
        page,
        limit: LIMIT,
        search: search || undefined,
      }),
  });

  return (
    <div className="space-y-4" data-theme="b">
      <h2 className="text-2xl font-bold tracking-tight">사용자 관리</h2>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 검색 */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="이름, 이메일 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>조직</TableHead>
                    <TableHead>현재 역할</TableHead>
                    <TableHead>역할 변경</TableHead>
                    <TableHead>가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        사용자가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.org?.name ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <RoleEditor user={user} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), 'yy.MM.dd')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                page={page}
                total={data?.total ?? 0}
                limit={LIMIT}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
