'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getMyOrders } from '@/lib/api/marketplace';
import { Pagination } from '@/components/common/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Package,
  CheckCircle2,
  XCircle,
  ShoppingBag,
} from 'lucide-react';
import type { Order } from '@/lib/api/marketplace';

const LIMIT = 15;

// ─── 등급 뱃지 ────────────────────────────────────────────────────────────────
function SmallGradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A:  'bg-green-100 text-green-700',
    B:  'bg-blue-100 text-blue-700',
    C:  'bg-yellow-100 text-yellow-700',
    D:  'bg-red-100 text-red-700',
    R1: 'bg-teal-100 text-teal-700',
    R2: 'bg-cyan-100 text-cyan-700',
    R3: 'bg-orange-100 text-orange-700',
  };
  const cls = colors[grade] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${cls}`}>
      {grade}
    </span>
  );
}

// ─── 주문 카드 ────────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
  const isCompleted = order.status === 'COMPLETED';

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* 좌측: 정보 */}
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isCompleted
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Package className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">
                  {order.lotNo}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs"
                >
                  {order.partType}
                </Badge>
              </div>

              {/* 등급 뱃지 */}
              <div className="flex items-center gap-1.5">
                {order.reuseGrade && (
                  <SmallGradeBadge grade={order.reuseGrade} />
                )}
                {order.recycleGrade && (
                  <SmallGradeBadge grade={order.recycleGrade} />
                )}
              </div>

              {order.caseNo && (
                <p className="text-xs text-muted-foreground">
                  케이스: <span className="font-mono">{order.caseNo}</span>
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                구매일: {format(new Date(order.purchasedAt), 'yyyy.MM.dd HH:mm')}
              </p>
            </div>
          </div>

          {/* 우측: 가격 + 상태 */}
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-primary">
              {order.price.toLocaleString('ko-KR')}원
            </p>
            <div className="mt-1 flex items-center justify-end gap-1">
              {isCompleted ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-600">
                    구매완료
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">취소됨</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 요약 ─────────────────────────────────────────────────────────────────────
function OrderSummary({ orders }: { orders: Order[] }) {
  const completed  = orders.filter((o) => o.status === 'COMPLETED');
  const totalSpent = completed.reduce((s, o) => s + o.price, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { label: '전체 주문', value: `${orders.length}건`, sub: '조회된 전체' },
        { label: '구매 완료', value: `${completed.length}건`, sub: 'COMPLETED' },
        {
          label: '총 구매액',
          value: `${totalSpent.toLocaleString('ko-KR')}원`,
          sub: '완료 기준',
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
export default function OrdersPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'orders', page],
    queryFn: () => getMyOrders({ page, limit: LIMIT }),
  });

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/marketplace">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">구매 내역</h2>
      </div>

      {/* 요약 */}
      {!isLoading && data && <OrderSummary orders={data.items} />}

      {/* 목록 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
          <ShoppingBag className="h-8 w-8 opacity-30" />
          <p>구매 내역이 없습니다</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/marketplace">마켓플레이스 보기</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data?.items.map((order) => (
              <OrderCard key={order.id} order={order} />
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
