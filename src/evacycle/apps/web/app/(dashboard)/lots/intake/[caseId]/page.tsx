'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCase } from '@/lib/api/cases';
import { intakeConfirm } from '@/lib/api/lots';
import { useAuthStore } from '@/lib/store/auth';
import { CaseStatusBadge } from '@/components/common/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  ChevronLeft,
  PackageCheck,
  Car,
  Hash,
  Clock,
} from 'lucide-react';

export default function IntakePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const { data: caseItem, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  });

  const intakeMut = useMutation({
    mutationFn: () => {
      if (!currentUser?.id) throw new Error('로그인이 필요합니다');
      return intakeConfirm(caseId, currentUser.id);
    },
    onSuccess: () => {
      // COD-58: 입고 확인 후 관련 쿼리 전체 invalidate
      qc.invalidateQueries({ queryKey: ['case', caseId] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['case-events', caseId] });
      qc.invalidateQueries({ queryKey: ['lots'] });
      toast({
        title: '입고 확인 완료',
        description: `${caseItem?.caseNo} → RECEIVED`,
      });
      router.push('/lots');
    },
    onError: () =>
      toast({ variant: 'destructive', title: '입고 확인 실패' }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!caseItem) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        케이스를 찾을 수 없습니다
      </div>
    );
  }

  const infoRows = [
    { label: '케이스번호', value: caseItem.caseNo,   icon: Hash },
    {
      label: '차량',
      value: `${caseItem.vehicleMaker} ${caseItem.vehicleModel} (${caseItem.vehicleYear}년식)`,
      icon: Car,
    },
    { label: 'VIN', value: caseItem.vin, icon: Hash },
    {
      label: '제출일',
      value: caseItem.submittedAt
        ? format(new Date(caseItem.submittedAt), 'yyyy.MM.dd HH:mm')
        : '-',
      icon: Clock,
    },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/lots')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">입고 확인</h2>
          <p className="text-sm text-muted-foreground">{caseItem.caseNo}</p>
        </div>
      </div>

      {/* 케이스 정보 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            케이스 정보
          </CardTitle>
          <CaseStatusBadge status={caseItem.status} />
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            {infoRows.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* 확인 카드 */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start gap-3">
            <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">입고 확인 처리</p>
              <p className="mt-1 text-sm text-muted-foreground">
                차량 실물을 확인했습니다. 확인 버튼을 누르면 케이스 상태가
                <strong> IN_TRANSIT → RECEIVED</strong>로 변경됩니다.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/lots')}
              disabled={intakeMut.isPending}
            >
              취소
            </Button>
            <Button
              onClick={() => intakeMut.mutate()}
              disabled={
                intakeMut.isPending || caseItem.status !== 'IN_TRANSIT'
              }
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              {intakeMut.isPending ? '처리 중...' : '입고 확인'}
            </Button>
          </div>

          {caseItem.status !== 'IN_TRANSIT' && (
            <p className="text-xs text-muted-foreground">
              ※ 이미 입고 처리된 케이스입니다 (현재 상태:{' '}
              <strong>{caseItem.status}</strong>)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
