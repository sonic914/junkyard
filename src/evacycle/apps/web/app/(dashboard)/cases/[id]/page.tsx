'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCase, submitCase, cancelCase, transitionCase } from '@/lib/api/cases';
import { getLots, createListing } from '@/lib/api/lots';
import { presignFile, uploadToMinIO, confirmFile, getCaseFiles } from '@/lib/api/files';
import { useAuthStore } from '@/lib/store/auth';
import { StatusStepper } from '@/components/cases/status-stepper';
import { GradingTab } from '@/components/cases/grading-tab';
import { CaseStatusBadge } from '@/components/common/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ShoppingCart,
  Upload,
  ImageIcon,
} from 'lucide-react';
import type { CaseStatus } from '@/types';

// ─── COD-56: 파일 업로드 탭 ─────────────────────────────────────────────────
function CaseFilesTab({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['case-files', caseId],
    queryFn: () => getCaseFiles(caseId),
  });

  const files = data?.files ?? [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const presigned = await presignFile(caseId, file);
      await uploadToMinIO(presigned.uploadUrl, file, setProgress);
      await confirmFile(caseId, {
        fileId: presigned.fileId,
        key: presigned.key,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
      toast({ title: '파일 업로드 완료' });
      qc.invalidateQueries({ queryKey: ['case-files', caseId] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '업로드 실패', description: err?.message ?? '알 수 없는 오류' });
    } finally {
      setUploading(false);
      setProgress(0);
      e.target.value = '';
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">첨부 파일</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 업로드 버튼 */}
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
          <Upload className="h-4 w-4" />
          {uploading ? `업로드 중... ${progress}%` : '파일 선택 (이미지/PDF, 최대 20MB)'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>

        {/* 파일 목록 */}
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : files.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">첨부된 파일이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate max-w-[200px]">{f.fileName}</span>
                  {f.fileSize && (
                    <span className="text-xs text-muted-foreground">
                      ({(f.fileSize / 1024).toFixed(0)}KB)
                    </span>
                  )}
                </div>
                {f.downloadUrl && (
                  <a
                    href={f.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    다운로드
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Listing 생성 모달 (COD-61) ──────────────────────────────────────────────
function ListingModal({
  open,
  onClose,
  caseId,
  lots,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  lots: Array<{ id: string; lotNo: string; partType: string }>;
}) {
  const qc = useQueryClient();
  const [prices, setPrices] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        lots.map((lot) =>
          createListing(lot.id, { price: Number(prices[lot.id] ?? 0) }),
        ),
      );
    },
    onSuccess: () => {
      toast({ title: '판매 등록 완료' });
      qc.invalidateQueries({ queryKey: ['case', caseId] });
      qc.invalidateQueries({ queryKey: ['lots'] });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: '판매 등록 실패' }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lot 판매 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {lots.map((lot) => (
            <div key={lot.id} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{lot.lotNo}</p>
                <p className="text-xs text-muted-foreground">{lot.partType}</p>
              </div>
              <div className="w-36">
                <Label htmlFor={`price-${lot.id}`} className="text-xs">판매 가격 (원)</Label>
                <Input
                  id={`price-${lot.id}`}
                  type="number"
                  placeholder="0"
                  value={prices[lot.id] ?? ''}
                  onChange={(e) =>
                    setPrices((prev) => ({ ...prev, [lot.id]: e.target.value }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || lots.some((l) => !prices[l.id])}
          >
            {mutation.isPending ? '등록 중...' : 'Listing 등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 상태별 가능한 JUNKYARD 액션 ─────────────────────────────────────────────
function CaseActions({
  caseId,
  status,
}: {
  caseId: string;
  status: CaseStatus;
}) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['case', caseId] });

  const submitMut = useMutation({
    mutationFn: () => submitCase(caseId),
    onSuccess: () => { toast({ title: '케이스 제출 완료' }); invalidate(); },
    onError: () => toast({ variant: 'destructive', title: '제출 실패' }),
  });

  const cocMut = useMutation({
    mutationFn: () => {
      if (!currentUser?.id) throw new Error('로그인이 필요합니다');
      return transitionCase(caseId, 'COC_SIGNED', {
        signedBy: currentUser.id,
        signedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => { toast({ title: 'CoC 서명 완료' }); invalidate(); },
    onError: () => toast({ variant: 'destructive', title: 'CoC 서명 실패' }),
  });

  const cancelMut = useMutation({
    mutationFn: (reason: string) => cancelCase(caseId, reason),
    onSuccess: () => { toast({ title: '케이스 취소 완료' }); invalidate(); },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? '취소 처리 중 오류가 발생했습니다.';
      toast({ variant: 'destructive', title: '취소 실패', description: String(msg) });
    },
  });

  // COD-61: GRADING 상태 → Listing 없는 Lot 조회
  const { data: lotsData } = useQuery({
    queryKey: ['case-lots-for-listing', caseId],
    queryFn: () => getLots({ caseId }),
    enabled: status === 'GRADING',
    select: (d) => (d.items ?? []).filter((l: any) => !l.listing),
  });
  const unlistedLots = lotsData ?? [];

  if (status === 'SETTLED' || status === 'SOLD' || status === 'CANCELLED') {
    return null;
  }

  return (
    <>
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
                const reason = prompt('취소 사유를 입력하세요 (10자 이상)');
                if (!reason || reason.length < 10) {
                  alert('취소 사유는 10자 이상 입력해야 합니다.');
                  return;
                }
                cancelMut.mutate(reason);
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
                const reason = prompt('취소 사유를 입력하세요 (10자 이상)');
                if (!reason || reason.length < 10) {
                  alert('취소 사유는 10자 이상 입력해야 합니다.');
                  return;
                }
                cancelMut.mutate(reason);
              }}
              disabled={cancelMut.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              취소
            </Button>
          </>
        )}

        {/* COD-61: GRADING 상태 + 미등록 Lot 있을 때 판매 등록 버튼 */}
        {status === 'GRADING' && unlistedLots.length > 0 && (
          <Button onClick={() => setListingModalOpen(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            판매 등록 ({unlistedLots.length}건)
          </Button>
        )}
      </div>

      {/* Listing 생성 모달 */}
      <ListingModal
        open={listingModalOpen}
        onClose={() => setListingModalOpen(false)}
        caseId={caseId}
        lots={unlistedLots}
      />
    </>
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

  const showGradingTab = ['GRADING', 'ON_SALE', 'SOLD', 'SETTLED'].includes(caseItem.status);
  const showFilesTab = true; // 항상 표시 (업로드 및 조회 가능)

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

      {/* 탭: 정보 / 그레이딩 */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">케이스 정보</TabsTrigger>
          <TabsTrigger value="files">첨부 파일</TabsTrigger>
          {showGradingTab && (
            <TabsTrigger value="grading">그레이딩 결과</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="info" className="space-y-4">
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
        </TabsContent>

        {/* COD-56: 첨부 파일 탭 */}
        <TabsContent value="files">
          <CaseFilesTab caseId={caseItem.id} />
        </TabsContent>

        {/* COD-60: 그레이딩 결과 탭 */}
        {showGradingTab && (
          <TabsContent value="grading">
            <GradingTab caseId={caseItem.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
