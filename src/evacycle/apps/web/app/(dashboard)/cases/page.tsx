'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getCases } from '@/lib/api/cases';
import { CaseCard } from '@/components/cases/case-card';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';

type FilterKey = 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED';

const FILTER_MAP: Record<FilterKey, string | undefined> = {
  ALL:       undefined,
  ACTIVE:    'SUBMITTED,IN_TRANSIT,RECEIVED,GRADING,ON_SALE',
  DONE:      'SOLD,SETTLED',
  CANCELLED: 'CANCELLED',
};

const FILTER_LABELS: Record<FilterKey, string> = {
  ALL:       '전체',
  ACTIVE:    '진행중',
  DONE:      '완료',
  CANCELLED: '취소',
};

const LIMIT = 12;

export default function CasesPage() {
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [page, setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['cases', { filter, page }],
    queryFn: () =>
      getCases({ page, limit: LIMIT, status: FILTER_MAP[filter] }),
  });

  function onFilterChange(v: string) {
    setFilter(v as FilterKey);
    setPage(1);
  }

  return (
    <div className="space-y-5" data-theme="a">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">케이스 관리</h2>
        <Button asChild>
          <Link href="/cases/new">
            <Plus className="mr-2 h-4 w-4" />
            새 케이스
          </Link>
        </Button>
      </div>

      {/* 필터 탭 */}
      <Tabs value={filter} onValueChange={onFilterChange}>
        <TabsList>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {FILTER_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 카드 그리드 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
          <p>케이스가 없습니다</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/cases/new">첫 케이스 등록하기</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((c) => (
              <CaseCard key={c.id} caseItem={c} />
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
