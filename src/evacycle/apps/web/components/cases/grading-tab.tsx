'use client';

/**
 * COD-60: 그레이딩 상세 내역 탭 컴포넌트
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const PART_TYPE_LABELS: Record<string, string> = {
  BATTERY:  '배터리',
  MOTOR:    '모터',
  CHARGER:  '충전기',
  INVERTER: '인버터',
  BMS:      'BMS',
  BODY:     '차체',
  OTHER:    '기타',
};

const REUSE_GRADE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  A: 'default',
  B: 'secondary',
  C: 'outline',
  D: 'destructive',
};

const ROUTING_LABELS: Record<string, string> = {
  REUSE:   '재사용',
  RECYCLE: '재활용',
  DISCARD: '폐기',
};

interface Grading {
  id: string;
  partType: string;
  reuseGrade: string | null;
  recycleGrade: string | null;
  routingDecision: string;
  notes: string | null;
  ruleSnapshot: Record<string, unknown> | null;
  actor: { id: string; name: string; role: string } | null;
  createdAt: string;
  lot?: { id: string; lotNo: string } | null;
}

async function fetchGradings(caseId: string): Promise<{ gradings: Grading[] }> {
  const { data } = await apiClient.get(`/cases/${caseId}/grade`);
  return data;
}

function GradingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

function GradingCard({ grading }: { grading: Grading }) {
  const partLabel = PART_TYPE_LABELS[grading.partType] ?? grading.partType;
  const grade = grading.reuseGrade ?? grading.recycleGrade ?? '-';
  const gradeVariant = grading.reuseGrade
    ? (REUSE_GRADE_VARIANTS[grading.reuseGrade] ?? 'outline')
    : 'secondary';

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-semibold">{partLabel}</p>
            <div className="flex items-center gap-2">
              <Badge variant={gradeVariant}>{grade}등급</Badge>
              <Badge variant="outline">{ROUTING_LABELS[grading.routingDecision] ?? grading.routingDecision}</Badge>
            </div>
            {grading.notes && (
              <p className="text-sm text-muted-foreground">{grading.notes}</p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            {grading.actor && <p>평가자: {grading.actor.name}</p>}
            <p>{format(new Date(grading.createdAt), 'yyyy.MM.dd HH:mm')}</p>
            {grading.lot && (
              <p className="font-mono">{grading.lot.lotNo}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GradingTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['case-gradings', caseId],
    queryFn: () => fetchGradings(caseId),
    enabled: !!caseId,
  });

  if (isLoading) return <GradingSkeleton />;

  const gradings = data?.gradings ?? [];

  if (gradings.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
        그레이딩 정보가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gradings.map((grading) => (
        <GradingCard key={grading.id} grading={grading} />
      ))}
    </div>
  );
}
