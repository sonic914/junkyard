'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCases } from '@/lib/api/cases';
import { CaseStatusBadge } from '@/components/common/status-badge';
import { Pagination } from '@/components/common/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import type { CaseStatus } from '@/types';

const CASE_STATUSES: { value: CaseStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'DRAFT', label: '초안' },
  { value: 'SUBMITTED', label: '제출됨' },
  { value: 'IN_TRANSIT', label: '운송중' },
  { value: 'RECEIVED', label: '입고됨' },
  { value: 'GRADING', label: '감정중' },
  { value: 'ON_SALE', label: '판매중' },
  { value: 'SOLD', label: '판매완료' },
  { value: 'SETTLED', label: '정산완료' },
  { value: 'CANCELLED', label: '취소됨' },
];

const LIMIT = 20;

export default function AdminCasesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['cases', { page, search, status }],
    queryFn: () =>
      getCases({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">케이스 관리</h2>

      <Card>
        <CardHeader>
          <CardTitle>전체 케이스 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 필터 */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="케이스번호, VIN, 차량모델 검색..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 테이블 */}
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
                    <TableHead>상태</TableHead>
                    <TableHead>차량</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>조직</TableHead>
                    <TableHead>제출일</TableHead>
                    <TableHead>생성일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Array.isArray(data?.items) ? data.items : []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        케이스가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {(Array.isArray(data?.items) ? data.items : []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {c.caseNo}
                      </TableCell>
                      <TableCell>
                        <CaseStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell>
                        {c.vehicleMaker} {c.vehicleModel} ({c.vehicleYear})
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.vin}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.org?.name ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.submittedAt
                          ? format(new Date(c.submittedAt), 'yy.MM.dd')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(c.createdAt), 'yy.MM.dd')}
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
