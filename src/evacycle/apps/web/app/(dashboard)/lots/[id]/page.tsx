'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getLot, createListing } from '@/lib/api/lots';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Package,
  Tag,
  Hash,
  ShoppingBag,
} from 'lucide-react';
import type { LotStatus } from '@/lib/api/lots';

// ─── 상태 뱃지 ────────────────────────────────────────────────────────────────
const LOT_STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING:   { label: '대기중',  variant: 'secondary' },
  ON_SALE:   { label: '판매중',  variant: 'default' },
  SOLD:      { label: '판매완료', variant: 'outline' },
  SETTLED:   { label: '정산완료', variant: 'outline' },
};

function LotStatusBadge({ status }: { status: string }) {
  const entry = LOT_STATUS_MAP[status];
  if (!entry) return <Badge variant="secondary">{status}</Badge>;
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

// ─── 그레이딩 등급 색상 ───────────────────────────────────────────────────────
const ROUTING_COLORS: Record<string, string> = {
  REUSE:   'text-green-600 bg-green-50 border-green-200',
  RECYCLE: 'text-blue-600 bg-blue-50 border-blue-200',
  DISCARD: 'text-red-600 bg-red-50 border-red-200',
};

// ─── 리스팅 폼 스키마 ─────────────────────────────────────────────────────────
const listingSchema = z.object({
  price: z.coerce
    .number()
    .min(1000, '최소 1,000원 이상')
    .max(100_000_000, '최대 1억원'),
});
type ListingForm = z.infer<typeof listingSchema>;

// ─── 리스팅 생성 다이얼로그 ───────────────────────────────────────────────────
function CreateListingDialog({
  open,
  onClose,
  lotId,
}: {
  open: boolean;
  onClose: () => void;
  lotId: string;
}) {
  const qc = useQueryClient();

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: { price: 0 },
  });

  const createMut = useMutation({
    mutationFn: (values: ListingForm) =>
      createListing(lotId, { price: values.price }),
    onSuccess: () => {
      toast({ title: 'Listing 생성 완료', description: '구매자에게 노출됩니다' });
      qc.invalidateQueries({ queryKey: ['lot', lotId] });
      onClose();
    },
    onError: () =>
      toast({ variant: 'destructive', title: 'Listing 생성 실패' }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>고정가 Listing 생성</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => createMut.mutate(v))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>판매 가격 (원)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      placeholder="예: 500000"
                      {...field}
                    />
                  </FormControl>
                  {field.value > 0 && (
                    <p className="text-xs text-muted-foreground">
                      = {Number(field.value).toLocaleString('ko-KR')}원
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={createMut.isPending}
              >
                취소
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? '생성 중...' : 'Listing 등록'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function LotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listingOpen, setListingOpen] = useState(false);

  const { data: lot, isLoading } = useQuery({
    queryKey: ['lot', id],
    queryFn: () => getLot(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Lot을 찾을 수 없습니다</p>
        <Button variant="outline" onClick={() => router.push('/lots')}>
          목록으로
        </Button>
      </div>
    );
  }

  const routingColor =
    ROUTING_COLORS[lot.routingDecision ?? ''] ?? 'text-muted-foreground';

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
          <h2 className="text-xl font-bold">{lot.lotNo}</h2>
          <div className="mt-0.5 flex items-center gap-2">
            <LotStatusBadge status={lot.status} />
            {lot.caseNo && (
              <span className="font-mono text-xs text-muted-foreground">
                {lot.caseNo}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lot 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="h-4 w-4" />
            Lot 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Lot 번호', value: lot.lotNo },
              { label: 'PartType', value: lot.partType },
              {
                label: '등록일',
                value: format(new Date(lot.createdAt), 'yyyy.MM.dd HH:mm'),
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 font-mono font-medium">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 그레이딩 결과 */}
      {(lot.reuseGrade || lot.recycleGrade || lot.routingDecision) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              그레이딩 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">재사용 등급</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {lot.reuseGrade ?? '-'}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">재활용 등급</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {lot.recycleGrade ?? '-'}
                </p>
              </div>
              <div
                className={`rounded-lg border p-3 ${routingColor}`}
              >
                <p className="text-xs opacity-70">라우팅</p>
                <p className="mt-1 text-sm font-bold">
                  {lot.routingDecision ?? '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listing 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Tag className="h-4 w-4" />
              Listing
            </CardTitle>
            {!lot.listing && (
              <CardDescription className="mt-1">
                아직 마켓플레이스에 등록되지 않았습니다
              </CardDescription>
            )}
          </div>
          {lot.status === 'PENDING' && !lot.listing && (
            <Button size="sm" onClick={() => setListingOpen(true)}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Listing 생성
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {lot.listing ? (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">판매 가격</span>
                <span className="text-xl font-bold text-primary">
                  {lot.listing.price.toLocaleString('ko-KR')}원
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">상태</span>
                <Badge
                  variant={
                    lot.listing.status === 'SOLD'
                      ? 'outline'
                      : lot.listing.status === 'ACTIVE'
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {lot.listing.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">등록일</span>
                <span className="text-sm">
                  {format(new Date(lot.listing.createdAt), 'yyyy.MM.dd')}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {lot.status === 'PENDING'
                ? '"Listing 생성" 버튼으로 마켓플레이스에 등록하세요'
                : `현재 상태(${lot.status})에서는 Listing을 생성할 수 없습니다`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Listing 생성 다이얼로그 */}
      <CreateListingDialog
        open={listingOpen}
        onClose={() => setListingOpen(false)}
        lotId={lot.id}
      />
    </div>
  );
}
