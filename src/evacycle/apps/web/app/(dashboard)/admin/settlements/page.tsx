'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminSettlements,
  approveSettlement,
  rejectSettlement,
  paySettlement,
  batchApproveSettlements,
} from '@/lib/api/admin';
import { SettlementStatusBadge } from '@/components/common/status-badge';
import { Pagination } from '@/components/common/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CheckSquare } from 'lucide-react';
import type { SettlementStatus } from '@/types';

const STATUSES: { value: SettlementStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'PENDING', label: '대기중' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'PAID', label: '지급완료' },
  { value: 'REJECTED', label: '거절됨' },
];

const LIMIT = 20;

export default function AdminSettlementsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settlements', { page, status }],
    queryFn: () =>
      getAdminSettlements({
        page,
        limit: LIMIT,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'settlements'] });
    setSelected(new Set());
  };

  const approveMut = useMutation({
    mutationFn: approveSettlement,
    onSuccess: () => {
      toast({ title: '승인 완료' });
      invalidate();
    },
    onError: () => toast({ variant: 'destructive', title: '승인 실패' }),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectSettlement(id),
    onSuccess: () => {
      toast({ title: '거절 완료' });
      invalidate();
    },
    onError: () => toast({ variant: 'destructive', title: '거절 실패' }),
  });

  const payMut = useMutation({
    mutationFn: paySettlement,
    onSuccess: () => {
      toast({ title: '지급 완료' });
      invalidate();
    },
    onError: () => toast({ variant: 'destructive', title: '지급 실패' }),
  });

  const batchMut = useMutation({
    mutationFn: batchApproveSettlements,
    onSuccess: (res) => {
      toast({ title: `일괄 승인 완료 — ${res.approved}건` });
      invalidate();
    },
    onError: () => toast({ variant: 'destructive', title: '일괄 승인 실패' }),
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pendingIds =
      (data?.items ?? [])
        .filter((s) => s.status === 'PENDING')
        .map((s) => s.id);
    if (pendingIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  }

  const pendingCount = (data?.items ?? []).filter((s) => s.status === 'PENDING').length ?? 0;
  const isAllSelected =
    pendingCount > 0 &&
    ((data?.items ?? []).filter((s) => s.status === 'PENDING') ?? []).every((s) =>
      selected.has(s.id),
    );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">정산 관리</h2>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>정산 목록</CardTitle>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                size="sm"
                onClick={() => batchMut.mutate(Array.from(selected))}
                disabled={batchMut.isPending}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                일괄 승인 ({selected.size}건)
              </Button>
            )}
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
                setSelected(new Set());
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
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
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 cursor-pointer"
                        title="PENDING 전체 선택"
                      />
                    </TableHead>
                    <TableHead>케이스번호</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>PartType</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        정산 내역이 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {(data?.items ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.status === 'PENDING' && (
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggleSelect(s.id)}
                            className="h-4 w-4 cursor-pointer"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {s.caseNo ?? s.caseId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                          {s.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <SettlementStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.partType ?? '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {s.amount.toLocaleString('ko-KR')}원
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(s.createdAt), 'yy.MM.dd')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {s.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => approveMut.mutate(s.id)}
                                disabled={approveMut.isPending}
                              >
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectMut.mutate(s.id)}
                                disabled={rejectMut.isPending}
                              >
                                거절
                              </Button>
                            </>
                          )}
                          {s.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => payMut.mutate(s.id)}
                              disabled={payMut.isPending}
                            >
                              지급
                            </Button>
                          )}
                        </div>
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
