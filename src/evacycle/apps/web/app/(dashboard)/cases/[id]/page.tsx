'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCase, submitCase, cancelCase, transitionCase } from '@/lib/api/cases';
import { StatusStepper } from '@/components/cases/status-stepper';
import { CaseStatusBadge } from '@/components/common/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Car,
  Hash,
  Clock,
  FileText,
  ChevronLeft,
  Send,
  PenLine,
  XCircle,
} from 'lucide-react';
import type { CaseStatus } from '@/types';

// ─── 상태별 가능한 JUNKYARD 액션 ─────────────────────────────────────────────
function CaseActions({
  caseId,
  status,
}: {
  caseId: string;
  status: CaseStatus;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['case', caseId] });

  const submitMut = useMutation({
    mutationFn: () => submitCase(caseId),
    onSuccess: () => { toast({ title: '케이스 제출 완료' }); invalidate(); },
    onError: () => toast({ variant: 'destructive', title: '제출 실패' }),
  });

  const cocMut = useMutation({
    mutationFn: () =>
      transitionCase(caseId, 'COC_SIGNED', {
        signedBy: 'JUNKYARD',
        signedAt: new Date().toISOString(),
      }),
    onSuccess: () => { toast({ title: 'CoC 서명 완료' }); invalidate(); },
    onError: () => toast({ variant: 'destructive', title: 'CoC 서명 실패' }),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelCase(caseId),
    onSuccess: () => { toast({ title: '케이스 취소 완료' }); invalidate(); },
    onError: () => toast({ variant: 'destructive', title: '취소 실패' }),
  });

  if (status === 'SETTLED' || status === 'SOLD' || status === 'CANCELLED') {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'DRAFT' && (
        <>
          <Button
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
          >
            <Send className="mr-2 h-4 w-4" />
            케이스 제출
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!confirm('케이스를 취소하시겠습니까?')) return;
              cancelMut.mutate();
            }}
            disabled={cancelMut.isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            취소
          </Button>
        </>
      )}

      {status === 'SUBMITTED' && (
        <>
          <Button
            onClick={() => cocMut.mutate()}
            disabled={cocMut.isPending}
          >
            <PenLine className="mr-2 h-4 w-4" />
            CoC 서명 (운송 시작)
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!confirm('제출된 케이스를 취소하시겠습니까?')) return;
              cancelMut.mutate();
            }}
            disabled={cancelMut.isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            취소
          </Button>
        </>
      )}
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: caseItem, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => getCase(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!caseItem) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>케이스를 찾을 수 없습니다</p>
        <Button variant="outline" onClick={() => router.push('/cases')}>
          목록으로
        </Button>
      </div>
    );
  }

  const infoRows = [
    { label: '케이스번호', value: caseItem.caseNo, icon: Hash },
    {
      label: '차량',
      value: `${caseItem.vehicleMaker} ${caseItem.vehicleModel} (${caseItem.vehicleYear}년식)`,
      icon: Car,
    },
    { label: 'VIN', value: caseItem.vin, icon: FileText },
    {
      label: '등록일',
      value: format(new Date(caseItem.createdAt), 'yyyy.MM.dd HH:mm'),
      icon: Clock,
    },
    ...(caseItem.submittedAt
      ? [
          {
            label: '제출일',
            value: format(new Date(caseItem.submittedAt), 'yyyy.MM.dd HH:mm'),
            icon: Clock,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/cases')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{caseItem.caseNo}</h2>
          <div className="mt-0.5">
            <CaseStatusBadge status={caseItem.status} />
          </div>
        </div>
      </div>

      {/* 진행 단계 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            진행 단계
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusStepper currentStatus={caseItem.status} />
        </CardContent>
      </Card>

      {/* 차량 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            차량 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
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

      {/* 액션 버튼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            액션
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CaseActions caseId={caseItem.id} status={caseItem.status} />

          {/* 타임라인 바로가기 */}
          <div className="flex items-center gap-2 border-t pt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/cases/${caseItem.id}/timeline`}>
                <Clock className="mr-1.5 h-4 w-4" />
                이벤트 타임라인
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
