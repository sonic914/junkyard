'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getCase } from '@/lib/api/cases';
import { gradeCase, createLot } from '@/lib/api/lots';
import type { ReuseGrade, RecycleGrade, RoutingDecision } from '@/lib/api/lots';
import { CaseStatusBadge } from '@/components/common/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChevronLeft, Microscope, AlertTriangle } from 'lucide-react';

// ─── 옵션 ─────────────────────────────────────────────────────────────────────
const PART_TYPES = ['BATTERY', 'MOTOR', 'BODY', 'INVERTER', 'CHARGER'];

const REUSE_GRADES: { value: ReuseGrade; label: string; desc: string }[] = [
  { value: 'A', label: 'A — 최상', desc: '재사용 최적, 손상 없음' },
  { value: 'B', label: 'B — 양호', desc: '경미한 마모, 재사용 가능' },
  { value: 'C', label: 'C — 보통', desc: '눈에 띄는 마모, 기능 정상' },
  { value: 'D', label: 'D — 불량', desc: '심각한 손상, 재사용 불가' },
];

const RECYCLE_GRADES: { value: RecycleGrade; label: string; desc: string }[] = [
  { value: 'R1', label: 'R1 — 고순도', desc: '90% 이상 재활용 가능' },
  { value: 'R2', label: 'R2 — 중순도', desc: '70~90% 재활용 가능' },
  { value: 'R3', label: 'R3 — 저순도', desc: '70% 미만, 특수처리 필요' },
];

const ROUTING_OPTIONS: {
  value: RoutingDecision;
  label: string;
  color: string;
}[] = [
  { value: 'REUSE',   label: '♻️ 재사용 (REUSE)',   color: 'border-green-500 bg-green-50' },
  { value: 'RECYCLE', label: '🔄 재활용 (RECYCLE)', color: 'border-blue-500 bg-blue-50' },
  { value: 'DISCARD', label: '🗑️ 폐기 (DISCARD)',  color: 'border-red-400 bg-red-50' },
];

// ─── 스키마 ───────────────────────────────────────────────────────────────────
const gradingSchema = z.object({
  partType:        z.string().min(1, 'PartType을 선택하세요'),
  weightKg:        z.coerce.number().min(0.01, '중량을 입력하세요'),
  reuseGrade:      z.enum(['A', 'B', 'C', 'D'] as const),
  recycleGrade:    z.enum(['R1', 'R2', 'R3'] as const),
  routingDecision: z.enum(['REUSE', 'RECYCLE', 'DISCARD'] as const),
  notes:           z.string().optional(),
});
type GradingForm = z.infer<typeof gradingSchema>;

// ─── 라우팅 카드 선택 ─────────────────────────────────────────────────────────
function RoutingSelector({
  value,
  onChange,
}: {
  value: RoutingDecision;
  onChange: (v: RoutingDecision) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {ROUTING_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg border-2 p-3 text-left text-sm transition-all',
            value === opt.value
              ? opt.color + ' ring-2 ring-offset-1 ring-primary'
              : 'border-muted bg-background hover:border-muted-foreground/40',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function GradingPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();

  const { data: caseItem, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  });

  const form = useForm<GradingForm>({
    resolver: zodResolver(gradingSchema),
    defaultValues: {
      partType:        '',
      weightKg:        50,
      reuseGrade:      'A',
      recycleGrade:    'R1',
      routingDecision: 'REUSE',
      notes:           '',
    },
  });

  const gradeMut = useMutation({
    mutationFn: async (values: GradingForm) => {
      // 1) 그레이딩 기록 생성
      const grading = await gradeCase(caseId, values);

      // 2) DISCARD가 아닐 때만 Lot 생성
      if (grading.routingDecision !== 'DISCARD') {
        await createLot(caseId, {
          partType: values.partType,
          weightKg: values.weightKg,
        });
      }
      return grading;
    },
    onSuccess: (result) => {
      const isDiscard = result.routingDecision === 'DISCARD';
      toast({
        title: '그레이딩 완료',
        description: isDiscard
          ? '폐기 판정 — Lot이 생성되지 않습니다'
          : `Lot 생성 완료 · ${result.partType}`,
      });
      router.push('/lots');
    },
    onError: () =>
      toast({ variant: 'destructive', title: '그레이딩 실패' }),
  });

  const watchRouting = form.watch('routingDecision');

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
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
          <h2 className="text-xl font-bold">부품 감정</h2>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {caseItem?.caseNo}
            </span>
            {caseItem && <CaseStatusBadge status={caseItem.status} />}
          </div>
        </div>
      </div>

      {/* 감정 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Microscope className="h-5 w-5 text-primary" />
            그레이딩 입력
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => gradeMut.mutate(v))}
              className="space-y-5"
            >
              {/* PartType */}
              <FormField
                control={form.control}
                name="partType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>부품 유형 (PartType)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="부품을 선택하세요" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PART_TYPES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 중량 */}
              <FormField
                control={form.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>중량 (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="예: 50"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      부품 실측 중량을 입력하세요 (기본값 50kg)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Reuse Grade */}
                <FormField
                  control={form.control}
                  name="reuseGrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>재사용 등급 (Reuse Grade)</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REUSE_GRADES.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              <div>
                                <p className="font-medium">{g.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {g.desc}
                                </p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Recycle Grade */}
                <FormField
                  control={form.control}
                  name="recycleGrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>재활용 등급 (Recycle Grade)</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RECYCLE_GRADES.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              <div>
                                <p className="font-medium">{g.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {g.desc}
                                </p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Routing Decision */}
              <FormField
                control={form.control}
                name="routingDecision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>라우팅 결정</FormLabel>
                    <FormControl>
                      <RoutingSelector
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* DISCARD 경고 */}
              {watchRouting === 'DISCARD' && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    <strong>폐기 판정</strong>: Lot이 생성되지 않으며, 이
                    케이스는 정산 없이 종료됩니다.
                  </p>
                </div>
              )}

              {/* 비고 */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비고 (선택)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="감정 메모 입력..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      특이사항이 있을 경우 기록하세요
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 액션 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/lots')}
                  disabled={gradeMut.isPending}
                >
                  취소
                </Button>
                <Button type="submit" disabled={gradeMut.isPending}>
                  <Microscope className="mr-2 h-4 w-4" />
                  {gradeMut.isPending ? '처리 중...' : '감정 완료'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
