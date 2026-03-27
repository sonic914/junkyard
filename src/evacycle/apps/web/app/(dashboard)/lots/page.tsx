'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getCases } from '@/lib/api/cases';
import { CaseStatusBadge } from '@/components/common/status-badge';
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
import { format } from 'date-fns';
import { PackageCheck, Microscope } from 'lucide-react';
import type { CaseStatus } from '@/types';

type HubFilter = 'ALL' | 'IN_TRANSIT' | 'RECEIVED' | 'GRADING';

const FILTER_OPTIONS: { value: HubFilter; label: string }[] = [
  { value: 'ALL',        label: '전체' },
  { value: 'IN_TRANSIT', label: '운송중' },
  { value: 'RECEIVED',   label: '입고됨' },
  { value: 'GRADING',    label: '감정중' },
];

const HUB_STATUSES = 'IN_TRANSIT,RECEIVED,GRADING';
const LIMIT = 20;

export default function LotsPage() {
  const [filter, setFilter] = useState<HubFilter>('ALL');
  const [page, setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['cases', 'hub', { filter, page }],
    queryFn: () =>
      getCases({
        page,
        limit: LIMIT,
        status: filter === 'ALL' ? HUB_STATUSES : filter,
      }),
  });

  return (
    <div className="space-y-5" data-theme="b">
      <h2 className="text-2xl font-bold tracking-tight">입고 관리</h2>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>입고 대기 케이스</CardTitle>
          <Select
            value={filter}
            onValueChange={(v) => { setFilter(v as HubFilter); setPage(1); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    <TableHead>케이스번호</TableHead>
                    <TableHead>차량</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>제출일</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        입고 대기 케이스가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {c.caseNo}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.vehicleMaker} {c.vehicleModel} ({c.vehicleYear})
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.vin}
                      </TableCell>
                      <TableCell>
                        <CaseStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.submittedAt
                          ? format(new Date(c.submittedAt), 'yy.MM.dd')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineActions status={c.status} caseId={c.id} />
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

function InlineActions({
  status,
  caseId,
}: {
  status: CaseStatus;
  caseId: string;
}) {
  if (status === 'IN_TRANSIT') {
    return (
      <Button asChild size="sm" variant="default">
        <Link href={`/lots/intake/${caseId}`}>
          <PackageCheck className="mr-1.5 h-4 w-4" />
          입고 확인
        </Link>
      </Button>
    );
  }
  if (status === 'RECEIVED') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/lots/grading/${caseId}`}>
          <Microscope className="mr-1.5 h-4 w-4" />
          감정 시작
        </Link>
      </Button>
    );
  }
  if (status === 'GRADING') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/lots/grading/${caseId}`}>
          <Microscope className="mr-1.5 h-4 w-4" />
          감정 계속
        </Link>
      </Button>
    );
  }
  return null;
}
