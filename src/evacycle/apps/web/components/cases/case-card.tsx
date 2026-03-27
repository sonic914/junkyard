'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Car, Calendar, Hash, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CaseStatusBadge } from '@/components/common/status-badge';
import type { CaseItem } from '@/types';

interface CaseCardProps {
  caseItem: CaseItem;
}

export function CaseCard({ caseItem: c }: CaseCardProps) {
  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex-1 space-y-3 pt-5">
        {/* 번호 + 상태 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="h-3.5 w-3.5" />
            <span className="font-mono font-medium text-foreground">
              {c.caseNo}
            </span>
          </div>
          <CaseStatusBadge status={c.status} />
        </div>

        {/* 차량 정보 */}
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">
              {c.vehicleMaker} {c.vehicleModel}
            </p>
            <p className="text-xs text-muted-foreground">{c.vehicleYear}년식</p>
          </div>
        </div>

        {/* VIN */}
        <p className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
          VIN: {c.vin}
        </p>

        {/* 날짜 */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {c.submittedAt
              ? `제출: ${format(new Date(c.submittedAt), 'yy.MM.dd')}`
              : `등록: ${format(new Date(c.createdAt), 'yy.MM.dd')}`}
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/cases/${c.id}`}>
            상세 보기
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
