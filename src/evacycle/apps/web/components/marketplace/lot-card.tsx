'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Package, Tag, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MarketplaceLot } from '@/lib/api/marketplace';

const GRADE_COLORS: Record<string, string> = {
  A:  'bg-green-100 text-green-700 border-green-200',
  B:  'bg-blue-100 text-blue-700 border-blue-200',
  C:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  D:  'bg-red-100 text-red-700 border-red-200',
  R1: 'bg-teal-100 text-teal-700 border-teal-200',
  R2: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  R3: 'bg-orange-100 text-orange-700 border-orange-200',
};

function GradeBadge({ grade, label }: { grade: string; label: string }) {
  const color = GRADE_COLORS[grade] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs font-bold ${color}`}>
      {label}: {grade}
    </span>
  );
}

interface LotCardProps {
  lot: MarketplaceLot;
}

export function LotCard({ lot }: LotCardProps) {
  return (
    <Card className="flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* 파트타입 헤더 */}
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold">{lot.partType}</span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {lot.lotNo}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* 등급 뱃지 */}
        <div className="flex flex-wrap gap-1.5">
          {lot.reuseGrade && (
            <GradeBadge grade={lot.reuseGrade} label="재사용" />
          )}
          {lot.recycleGrade && (
            <GradeBadge grade={lot.recycleGrade} label="재활용" />
          )}
          {lot.routingDecision && (
            <span
              className={`rounded border px-1.5 py-0.5 text-xs font-medium ${
                lot.routingDecision === 'REUSE'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              {lot.routingDecision}
            </span>
          )}
        </div>

        {/* 가격 */}
        <div className="flex items-center gap-1.5">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-xl font-bold text-primary">
            {lot.listing.price.toLocaleString('ko-KR')}
            <span className="ml-0.5 text-sm font-normal text-muted-foreground">원</span>
          </span>
        </div>

        {/* 등록일 */}
        <p className="text-xs text-muted-foreground">
          등록: {format(new Date(lot.listing.createdAt), 'yy.MM.dd')}
        </p>
      </CardContent>

      <CardFooter className="pt-0">
        <Button asChild className="w-full" size="sm">
          <Link href={`/marketplace/${lot.id}`}>
            상세 보기
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
