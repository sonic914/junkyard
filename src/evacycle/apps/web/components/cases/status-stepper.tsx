'use client';

import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseStatus } from '@/types';

interface Step {
  status: CaseStatus;
  label: string;
}

const FLOW_STEPS: Step[] = [
  { status: 'DRAFT',      label: '초안' },
  { status: 'SUBMITTED',  label: '제출됨' },
  { status: 'IN_TRANSIT', label: '운송중' },
  { status: 'RECEIVED',   label: '입고됨' },
  { status: 'GRADING',    label: '감정중' },
  { status: 'ON_SALE',    label: '판매중' },
  { status: 'SOLD',       label: '판매완료' },
  { status: 'SETTLED',    label: '정산완료' },
];

const STATUS_ORDER: Record<CaseStatus, number> = {
  DRAFT:      0,
  SUBMITTED:  1,
  IN_TRANSIT: 2,
  RECEIVED:   3,
  GRADING:    4,
  ON_SALE:    5,
  SOLD:       6,
  SETTLED:    7,
  CANCELLED: -1,
};

interface StatusStepperProps {
  currentStatus: CaseStatus;
}

export function StatusStepper({ currentStatus }: StatusStepperProps) {
  const currentIdx = STATUS_ORDER[currentStatus] ?? -1;
  const isCancelled = currentStatus === 'CANCELLED';

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-destructive bg-destructive/5 py-4 text-sm font-medium text-destructive">
        ✕ 케이스 취소됨
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-max items-center gap-0">
        {FLOW_STEPS.map((step, i) => {
          const isDone    = i < currentIdx;
          const isActive  = i === currentIdx;
          const isPending = i > currentIdx;

          return (
            <div key={step.status} className="flex items-center">
              {/* 노드 */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                    isDone  && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-primary/10 text-primary',
                    isPending && 'border-muted bg-background text-muted-foreground',
                  )}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Circle
                      className={cn(
                        'h-3 w-3',
                        isActive ? 'fill-primary text-primary' : 'fill-muted text-muted',
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'whitespace-nowrap text-xs',
                    isDone   && 'text-primary',
                    isActive && 'font-semibold text-primary',
                    isPending && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* 연결선 */}
              {i < FLOW_STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 w-8',
                    i < currentIdx ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
