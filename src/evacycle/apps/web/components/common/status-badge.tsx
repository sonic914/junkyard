import { Badge } from '@/components/ui/badge';
import type { CaseStatus, SettlementStatus } from '@/types';

const CASE_STATUS_MAP: Record<
  CaseStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  DRAFT:      { label: '초안', variant: 'secondary' },
  SUBMITTED:  { label: '제출됨', variant: 'default' },
  IN_TRANSIT: { label: '운송중', variant: 'default' },
  RECEIVED:   { label: '입고됨', variant: 'default' },
  GRADING:    { label: '감정중', variant: 'default' },
  ON_SALE:    { label: '판매중', variant: 'default' },
  SOLD:       { label: '판매완료', variant: 'default' },
  SETTLED:    { label: '정산완료', variant: 'outline' },
  CANCELLED:  { label: '취소됨', variant: 'destructive' },
};

const SETTLEMENT_STATUS_MAP: Record<
  SettlementStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING:  { label: '대기중', variant: 'secondary' },
  APPROVED: { label: '승인됨', variant: 'default' },
  PAID:     { label: '지급완료', variant: 'outline' },
  REJECTED: { label: '거절됨', variant: 'destructive' },
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const { label, variant } = CASE_STATUS_MAP[status] ?? {
    label: status,
    variant: 'secondary' as const,
  };
  return <Badge variant={variant}>{label}</Badge>;
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  const { label, variant } = SETTLEMENT_STATUS_MAP[status] ?? {
    label: status,
    variant: 'secondary' as const,
  };
  return <Badge variant={variant}>{label}</Badge>;
}
