'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMySettlements } from '@/lib/api/settlements';
import { Pagination } from '@/components/common/pagination';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import type { Settlement, SettlementStatus, SettlementType } from '@/types';

// ─── 상태 이모지 ──────────────────────────────────────────────────────────────
const STATUS_EMOJI: Record<SettlementStatus, string> = {
  PENDING:  '⏳',
  APPROVED: '✅',
  PAID:     '💰',
  REJECTED: '❌',
};

const STATUS_LABEL: Record<SettlementStatus, string> = {
  PENDING:  '대기중',
  APPROVED: '승인됨',
  PAID:     '지급완료',
  REJECTED: '거절됨',
};

const TYPE_LABEL: Record<SettlementType, string> = {
  M0:    'M0 (기본)',
  DELTA: 'DELTA (추가)',
};

// ─── 정산 카드 ────────────────────────────────────────────────────────────────
function SettlementCard({ s }: { s: Settlement }) {
  const emoji = STATUS_EMOJI[s.status];
  const isPaid = s.status === 'PAID';
  const isDelta = s.type === 'DELTA';

  return (
    <Card
      className={
        isPaid
          ? 'border-green-300 bg-green-50/50'
          : s.status === 'REJECTED'
            ? 'border-destructive/30 bg-red-50/30'
            : undefined
      }
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <p className="text-xs text-muted-foreground">
            {s.caseNo ?? s.caseId.slice(0, 8)}
          </p>
          <CardTitle className="mt-0.5 text-sm">
            <span
              className={
                isDelta
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }
            >
              {TYPE_LABEL[s.type]}
            </span>
          </CardTitle>
        </div>
        <span className="text-lg" title={STATUS_LABEL[s.status]}>
          {emoji}
        </span>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* 금액 강조 */}
        <p
          className={
            isPaid
              ? 'text-2xl font-bold text-green-700'
              : 'text-2xl font-bold text-foreground'
          }
        >
          {s.amount.toLocaleString('ko-KR')}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            원
          </span>
        </p>

        {/* 상태 + PartType */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              isPaid
                ? 'font-medium text-green-600'
                : s.status === 'REJECTED'
                  ? 'font-medium text-destructive'
                  : 'text-muted-foreground'
            }
          >
            {STATUS_LABEL[s.status]}
          </span>
          {s.partType && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                {s.partType}
              </span>
            </>
          )}
        </div>

        {/* 날짜 */}
        <p className="text-xs text-muted-foreground">
          {isPaid && s.paidAt
            ? `지급: ${format(new Date(s.paidAt), 'yy.MM.dd')}`
            : `생성: ${format(new Date(s.createdAt), 'yy.MM.dd')}`}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── 요약 KPI ─────────────────────────────────────────────────────────────────
function SettlementSummary({
  items,
}: {
  items: Settlement[];
}) {
  const totalPaid = items
    .filter((s) => s.status === 'PAID')
    .reduce((acc, s) => acc + s.amount, 0);
  const pendingCount = items.filter((s) => s.status === 'PENDING').length;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        {
          label: '전체 정산',
          value: `${items.length}건`,
          sub: '조회된 전체',
        },
        {
          label: '대기중',
          value: `${pendingCount}건`,
          sub: '승인 대기',
        },
        {
          label: '수령 금액',
          value: `${totalPaid.toLocaleString('ko-KR')}원`,
          sub: '지급 완료 합계',
        },
      ].map(({ label, value, sub }) => (
        <Card key={label}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
const LIMIT = 12;

export default function MySettlementsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['my-settlements', { page, status }],
    queryFn: () =>
      getMySettlements({
        page,
        limit: LIMIT,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">정산 내역</h2>
        <Select
          value={status}
          onValueChange={(v) => { setStatus(v); setPage(1); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="PENDING">⏳ 대기중</SelectItem>
            <SelectItem value="APPROVED">✅ 승인됨</SelectItem>
            <SelectItem value="PAID">💰 지급완료</SelectItem>
            <SelectItem value="REJECTED">❌ 거절됨</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 요약 */}
      {!isLoading && data && (
        <SettlementSummary items={data.items} />
      )}

      {/* 카드 그리드 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          정산 내역이 없습니다
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((s) => (
              <SettlementCard key={s.id} s={s} />
            ))}
          </div>
          <Pagination
            page={page}
            total={data?.total ?? 0}
            limit={LIMIT}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
