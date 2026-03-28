'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getMarketplaceLot, purchaseLot } from '@/lib/api/marketplace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Package,
  Tag,
  ShoppingCart,
  Car,
  Hash,
  CheckCircle2,
} from 'lucide-react';

// ─── 등급 색상 ────────────────────────────────────────────────────────────────
const GRADE_BG: Record<string, string> = {
  A:  'bg-green-50 border-green-300 text-green-700',
  B:  'bg-blue-50 border-blue-300 text-blue-700',
  C:  'bg-yellow-50 border-yellow-300 text-yellow-700',
  D:  'bg-red-50 border-red-300 text-red-700',
  R1: 'bg-teal-50 border-teal-300 text-teal-700',
  R2: 'bg-cyan-50 border-cyan-300 text-cyan-700',
  R3: 'bg-orange-50 border-orange-300 text-orange-700',
};

function GradeCard({
  label,
  grade,
  sub,
}: {
  label: string;
  grade: string;
  sub?: string;
}) {
  const cls = GRADE_BG[grade] ?? 'bg-muted border-muted-foreground/20 text-foreground';
  return (
    <div className={`flex flex-col items-center rounded-lg border p-4 ${cls}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-black">{grade}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

// ─── 구매 확인 모달 ───────────────────────────────────────────────────────────
function PurchaseDialog({
  open,
  onClose,
  price,
  lotNo,
  partType,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  price: number;
  lotNo: string;
  partType: string;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            구매 확인
          </DialogTitle>
          <DialogDescription>
            아래 Lot을 구매하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lot 번호</span>
            <span className="font-mono font-medium">{lotNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">부품</span>
            <span className="font-medium">{partType}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">결제 금액</span>
            <span className="text-lg font-bold text-primary">
              {price.toLocaleString('ko-KR')}원
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            취소
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            {isLoading ? '처리 중...' : '구매 확정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function MarketplaceLotPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: lot, isLoading } = useQuery({
    queryKey: ['marketplace', 'lot', id],
    queryFn: () => getMarketplaceLot(id),
    enabled: !!id,
  });

  const purchaseMut = useMutation({
    mutationFn: () => purchaseLot(id),
    onSuccess: (result) => {
      toast({
        title: '🎉 구매 완료!',
        description: `${result.lotNo} 구매가 확정되었습니다`,
      });
      router.push('/marketplace/orders');
    },
    onError: () =>
      toast({ variant: 'destructive', title: '구매 실패', description: '잠시 후 다시 시도해주세요' }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Lot을 찾을 수 없습니다</p>
        <Button variant="outline" onClick={() => router.push('/marketplace')}>
          마켓으로
        </Button>
      </div>
    );
  }

  const isSoldOut = lot.listing?.status !== 'ACTIVE';

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/marketplace')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{lot.partType}</h2>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {lot.lotNo}
            </Badge>
            {isSoldOut && (
              <Badge variant="secondary">판매 완료</Badge>
            )}
          </div>
        </div>
      </div>

      {/* 가격 카드 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between pt-5 pb-5">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">판매가</p>
              <p className="text-3xl font-black text-primary">
                {lot.listing?.price.toLocaleString('ko-KR')}
                <span className="ml-1 text-base font-normal">원</span>
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => setDialogOpen(true)}
            disabled={isSoldOut}
          >
            {isSoldOut ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                판매 완료
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                구매하기
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 그레이딩 결과 */}
      {(lot.reuseGrade || lot.recycleGrade) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              그레이딩 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {lot.reuseGrade && (
                <GradeCard
                  label="재사용 등급"
                  grade={lot.reuseGrade}
                  sub={
                    lot.reuseGrade === 'A'
                      ? '최상'
                      : lot.reuseGrade === 'B'
                        ? '양호'
                        : lot.reuseGrade === 'C'
                          ? '보통'
                          : '불량'
                  }
                />
              )}
              {lot.recycleGrade && (
                <GradeCard
                  label="재활용 등급"
                  grade={lot.recycleGrade}
                  sub={
                    lot.recycleGrade === 'R1'
                      ? '고순도'
                      : lot.recycleGrade === 'R2'
                        ? '중순도'
                        : '저순도'
                  }
                />
              )}
              {lot.routingDecision && (
                <div
                  className={`flex flex-col items-center rounded-lg border p-4 ${
                    lot.routingDecision === 'REUSE'
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-blue-300 bg-blue-50 text-blue-700'
                  }`}
                >
                  <p className="text-xs font-medium opacity-70">분류</p>
                  <p className="mt-1 text-sm font-bold">{lot.routingDecision}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 케이스 / 차량 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            출처 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lot.caseNo && (
            <div className="flex items-center gap-2 text-sm">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">케이스번호</span>
              <span className="font-mono font-medium">{lot.caseNo}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">부품</span>
            <span className="font-medium">{lot.partType}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">등록일</span>
            <span className="text-sm">
              {format(new Date(lot.createdAt), 'yyyy.MM.dd')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 구매 확인 모달 */}
      {lot.listing && (
        <PurchaseDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          price={lot.listing.price}
          lotNo={lot.lotNo}
          partType={lot.partType}
          onConfirm={() => purchaseMut.mutate()}
          isLoading={purchaseMut.isPending}
        />
      )}
    </div>
  );
}
