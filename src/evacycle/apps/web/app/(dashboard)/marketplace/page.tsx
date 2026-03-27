'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getMarketplaceLots } from '@/lib/api/marketplace';
import { LotCard } from '@/components/marketplace/lot-card';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, ClipboardList } from 'lucide-react';

type SortKey = 'price_asc' | 'price_desc' | 'created_desc';

const PART_TYPES = ['ALL', 'BATTERY', 'MOTOR', 'BODY', 'INVERTER', 'CHARGER'];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created_desc', label: '최신순' },
  { value: 'price_asc',    label: '가격 낮은순' },
  { value: 'price_desc',   label: '가격 높은순' },
];

const LIMIT = 12;

export default function MarketplacePage() {
  const [partType, setPartType] = useState('ALL');
  const [sortBy, setSortBy]     = useState<SortKey>('created_desc');
  const [page, setPage]         = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', { partType, sortBy, page }],
    queryFn: () =>
      getMarketplaceLots({
        partType: partType === 'ALL' ? undefined : partType,
        sortBy,
        page,
        limit: LIMIT,
      }),
  });

  return (
    <div className="space-y-5" data-theme="a">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">마켓플레이스</h2>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/marketplace/orders">
            <ClipboardList className="mr-2 h-4 w-4" />
            구매 내역
          </Link>
        </Button>
      </div>

      {/* 필터 + 정렬 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* PartType 필터 버튼 */}
        <div className="flex flex-wrap gap-1.5">
          {PART_TYPES.map((p) => (
            <button
              key={p}
              onClick={() => { setPartType(p); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                partType === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {p === 'ALL' ? '전체' : p}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <Select
            value={sortBy}
            onValueChange={(v) => { setSortBy(v as SortKey); setPage(1); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 카탈로그 그리드 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
          <ShoppingBag className="h-8 w-8 opacity-30" />
          <p>판매 중인 Lot이 없습니다</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            총 {data?.total ?? 0}개 Lot
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((lot) => (
              <LotCard key={lot.id} lot={lot} />
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
