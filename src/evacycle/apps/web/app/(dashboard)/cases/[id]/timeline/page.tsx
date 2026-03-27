'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCaseTimeline } from '@/lib/api/cases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ChevronLeft, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// 이벤트 타입별 색상
const EVENT_COLORS: Record<string, string> = {
  CASE_CREATED:      'bg-blue-500',
  CASE_SUBMITTED:    'bg-indigo-500',
  COC_SIGNED:        'bg-purple-500',
  CASE_RECEIVED:     'bg-yellow-500',
  GRADING_COMPLETED: 'bg-orange-500',
  LOT_CREATED:       'bg-teal-500',
  LISTING_SOLD:      'bg-green-500',
  SETTLEMENT_PAID:   'bg-primary',
  CASE_CANCELLED:    'bg-red-500',
};

export default function CaseTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['case', id, 'timeline'],
    queryFn: () => getCaseTimeline(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-theme="a">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        타임라인을 불러올 수 없습니다
      </div>
    );
  }

  const validCount = data.timeline.filter((e) => e.hashValid !== false).length;
  const invalidCount = data.timeline.filter((e) => e.hashValid === false).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5" data-theme="a">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/cases/${id}`)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">이벤트 타임라인</h2>
          <p className="text-sm text-muted-foreground">{data.caseNo}</p>
        </div>
      </div>

      {/* 해시체인 요약 */}
      <Card
        className={cn(
          'border',
          invalidCount === 0
            ? 'border-green-500 bg-green-50'
            : 'border-destructive bg-red-50',
        )}
      >
        <CardContent className="flex items-center gap-3 pt-4 pb-4">
          {invalidCount === 0 ? (
            <>
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-700">
                  해시체인 무결성 정상
                </p>
                <p className="text-xs text-green-600">
                  전체 {validCount}개 이벤트 검증 통과
                </p>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">
                  해시체인 이상 감지
                </p>
                <p className="text-xs text-destructive">
                  {invalidCount}개 이벤트 무결성 오류
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 타임라인 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            이벤트 목록 ({data.timeline.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.timeline.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              이벤트가 없습니다
            </p>
          ) : (
            <ol className="relative space-y-0 border-l border-muted">
              {data.timeline.map((event, i) => {
                const dotColor =
                  EVENT_COLORS[event.eventType] ?? 'bg-muted-foreground';
                const isHashValid = event.hashValid !== false;

                return (
                  <li key={event.id} className="relative pb-6 pl-6 last:pb-0">
                    {/* 타임라인 점 */}
                    <span
                      className={cn(
                        'absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background',
                        dotColor,
                      )}
                    />

                    <div className="space-y-1">
                      {/* 이벤트 유형 + 해시 상태 */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono text-xs"
                        >
                          {event.eventType}
                        </Badge>
                        {isHashValid ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <ShieldCheck className="h-3 w-3" /> 해시 유효
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <ShieldAlert className="h-3 w-3" /> 해시 오류
                          </span>
                        )}
                      </div>

                      {/* 일시 */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(
                          new Date(event.createdAt),
                          'yyyy.MM.dd HH:mm:ss',
                        )}
                      </div>

                      {/* 해시 */}
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        <span>
                          hash:{' '}
                          <code className="font-mono">
                            {event.hash.slice(0, 12)}...
                          </code>
                        </span>
                        <span>
                          prev:{' '}
                          <code className="font-mono">
                            {event.prevHash
                              ? `${event.prevHash.slice(0, 12)}...`
                              : '—'}
                          </code>
                        </span>
                      </div>

                      {/* 페이로드 (접기) */}
                      {Object.keys(event.payload).length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            페이로드 보기
                          </summary>
                          <pre className="mt-1 rounded bg-muted p-2 text-xs">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
