'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCases } from '@/lib/api/cases';
import { getOrganizations, updateAdminCase } from '@/lib/api/admin';
import { CaseStatusBadge } from '@/components/common/status-badge';
import { Pagination } from '@/components/common/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, Building2 } from 'lucide-react';
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

// 허브 배정 가능한 상태 (COD-62: RECEIVED 이전까지만)
const HUB_ASSIGNABLE_STATUSES: CaseStatus[] = ['DRAFT', 'SUBMITTED', 'IN_TRANSIT'];

// ─── COD-62: 허브 배정 모달 ──────────────────────────────────────────────────
function HubAssignModal({
  open,
  onClose,
  caseId,
  caseNo,
  currentHubName,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseNo: string;
  currentHubName?: string;
}) {
  const qc = useQueryClient();
  const [selectedHubId, setSelectedHubId] = useState<string>('');

  // 활성 HUB 조직 목록
  const { data: orgs = [] } = useQuery({
    queryKey: ['admin-orgs'],
    queryFn: getOrganizations,
    select: (data) => data.filter((o) => o.type === 'HUB' && o.isActive !== false),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => updateAdminCase(caseId, { hubOrgId: selectedHubId }),
    onSuccess: () => {
      toast({ title: '허브 배정 완료' });
      qc.invalidateQueries({ queryKey: ['cases'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? '허브 배정에 실패했습니다.';
      toast({ variant: 'destructive', title: '배정 실패', description: String(msg) });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>허브 배정</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            케이스: <span className="font-mono font-medium">{caseNo}</span>
          </p>
          {currentHubName && (
            <p className="text-sm">현재 허브: <span className="font-medium">{currentHubName}</span></p>
          )}
          <div>
            <Select value={selectedHubId} onValueChange={setSelectedHubId}>
              <SelectTrigger>
                <SelectValue placeholder="허브 선택..." />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
                {orgs.length === 0 && (
                  <div className="py-2 text-center text-sm text-muted-foreground">
                    활성 허브 없음
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selectedHubId || mutation.isPending}
          >
            {mutation.isPending ? '배정 중...' : '허브 배정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
export default function AdminCasesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [hubUnassignedOnly, setHubUnassignedOnly] = useState(false);

  // COD-62: 허브 배정 모달 상태
  const [assignModal, setAssignModal] = useState<{
    caseId: string;
    caseNo: string;
    currentHubName?: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cases', { page, search, status, hubUnassignedOnly }],
    queryFn: () =>
      getCases({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  // COD-62: 클라이언트 사이드 허브 미배정 필터
  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const items = hubUnassignedOnly
    ? rawItems.filter((c) => !c.hubOrgId)
    : rawItems;

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
            {/* COD-62: 허브 미배정 필터 토글 */}
            <Button
              variant={hubUnassignedOnly ? 'default' : 'outline'}
              size="sm"
              className="whitespace-nowrap"
              onClick={() => {
                setHubUnassignedOnly((v) => !v);
                setPage(1);
              }}
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              허브 미배정
            </Button>
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
                    <TableHead>허브</TableHead>
                    <TableHead>제출일</TableHead>
                    <TableHead>생성일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        케이스가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((c) => (
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
                      {/* COD-62: 허브 배정 컬럼 */}
                      <TableCell className="text-sm">
                        {c.hubOrgId ? (
                          <span className="text-sm">{c.hubOrg?.name ?? c.hubOrgId}</span>
                        ) : HUB_ASSIGNABLE_STATUSES.includes(c.status as CaseStatus) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              setAssignModal({
                                caseId: c.id,
                                caseNo: c.caseNo,
                              })
                            }
                          >
                            배정하기
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-xs">미배정</Badge>
                        )}
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

      {/* COD-62: 허브 배정 모달 */}
      {assignModal && (
        <HubAssignModal
          open={!!assignModal}
          onClose={() => setAssignModal(null)}
          caseId={assignModal.caseId}
          caseNo={assignModal.caseNo}
          currentHubName={assignModal.currentHubName}
        />
      )}
    </div>
  );
}
