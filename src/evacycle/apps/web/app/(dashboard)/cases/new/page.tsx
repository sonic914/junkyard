'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCase, submitCase } from '@/lib/api/cases';
import { presignFile, uploadToMinIO, confirmFile } from '@/lib/api/files';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, Upload, X, FileText, ChevronRight } from 'lucide-react';
import type { CaseItem } from '@/types';

// ─── 스텝 인디케이터 ──────────────────────────────────────────────────────────
const STEPS = [
  { idx: 1, label: '차량 정보' },
  { idx: 2, label: '파일 첨부' },
  { idx: 3, label: '확인' },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.idx} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                current > step.idx
                  ? 'border-primary bg-primary text-primary-foreground'
                  : current === step.idx
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground',
              )}
            >
              {current > step.idx ? <Check className="h-4 w-4" /> : step.idx}
            </div>
            <span
              className={cn(
                'text-xs',
                current === step.idx
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'mx-2 mb-4 h-0.5 w-12',
                current > step.idx + 0 ? 'bg-primary' : 'bg-muted',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: 차량 정보 ────────────────────────────────────────────────────────
const vehicleSchema = z.object({
  vehicleMaker: z.string().min(1, '제조사를 입력하세요'),
  vehicleModel: z.string().min(1, '모델명을 입력하세요'),
  vehicleYear:  z.coerce.number().min(2000).max(2030, '유효한 연도를 입력하세요'),
  vin:          z.string().length(17, 'VIN은 정확히 17자리입니다'),
});
type VehicleForm = z.infer<typeof vehicleSchema>;

function Step1({
  onNext,
  isLoading = false,
}: {
  onNext: (values: VehicleForm) => void;
  isLoading?: boolean;
}) {
  const form = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleMaker: '',
      vehicleModel: '',
      vehicleYear: new Date().getFullYear(),
      vin: '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="vehicleMaker"
            render={({ field }) => (
              <FormItem>
                <FormLabel>제조사</FormLabel>
                <FormControl>
                  <Input placeholder="예: 현대" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vehicleModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>모델명</FormLabel>
                <FormControl>
                  <Input placeholder="예: 아이오닉5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vehicleYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>연식</FormLabel>
                <FormControl>
                  <Input type="number" min={2000} max={2030} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VIN (차대번호)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="17자리 입력"
                    maxLength={17}
                    className="font-mono uppercase"
                    {...field}
                    onChange={(e) =>
                      field.onChange(e.target.value.toUpperCase())
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            data-testid="step1-next"
            disabled={isLoading}
            onClick={form.handleSubmit(onNext)}
          >
            {isLoading ? '케이스 생성 중...' : <>다음 <ChevronRight className="ml-1 h-4 w-4" /></>}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Step 2: 파일 첨부 ────────────────────────────────────────────────────────
interface UploadedFile {
  file: File;
  fileId: string;
  key: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

function Step2({
  caseId,
  onNext,
  onBack,
}: {
  caseId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // stale closure 방지 — uploadAll 완료 후 최신 파일 상태 참조용
  const filesRef = useRef<UploadedFile[]>([]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const added: UploadedFile[] = Array.from(fileList).map((f) => ({
      file: f,
      fileId: '',
      key: '',
      progress: 0,
      status: 'pending',
    }));
    setFiles((prev) => {
      const next = [...prev, ...added];
      filesRef.current = next;
      return next;
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function uploadAll() {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) {
      onNext();
      return;
    }

    setIsUploading(true);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status !== 'pending') continue;

      try {
        // 1) Presign
        const { uploadUrl, key, fileId } = await presignFile(caseId, f.file);

        // 2) Upload
        setFiles((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: 'uploading' } : x,
          ),
        );
        await uploadToMinIO(uploadUrl, f.file, (pct) => {
          setFiles((prev) =>
            prev.map((x, idx) => (idx === i ? { ...x, progress: pct } : x)),
          );
        });

        // 3) Confirm
        await confirmFile(caseId, {
          fileId,
          key,
          filename: f.file.name,
          contentType: f.file.type,
          size: f.file.size,
        });

        setFiles((prev) => {
          const next = prev.map((x, idx) =>
            idx === i ? { ...x, status: 'done' as const, fileId, key, progress: 100 } : x,
          );
          filesRef.current = next;
          return next;
        });
      } catch {
        setFiles((prev) => {
          const next = prev.map((x, idx) =>
            idx === i ? { ...x, status: 'error' as const } : x,
          );
          filesRef.current = next;
          return next;
        });
        toast({ variant: 'destructive', title: `${f.file.name} 업로드 실패` });
      }
    }
    setIsUploading(false);

    // filesRef.current로 최신 상태 확인 (stale closure 방지)
    const anyError = filesRef.current.some((f) => f.status === 'error');
    if (!anyError) onNext();
  }

  return (
    <div className="space-y-4">
      {/* 드롭존 */}
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 py-10 transition-colors hover:border-primary hover:bg-primary/5"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">파일을 드래그하거나 클릭해서 선택</p>
          <p className="text-xs text-muted-foreground">
            이미지 10MB, 문서 20MB 이내 (복수 선택 가능)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* 파일 목록 */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{f.file.name}</p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      f.status === 'error' ? 'bg-destructive' : 'bg-primary',
                    )}
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 text-xs',
                  f.status === 'done' && 'text-primary',
                  f.status === 'error' && 'text-destructive',
                  (f.status === 'pending' || f.status === 'uploading') &&
                    'text-muted-foreground',
                )}
              >
                {f.status === 'done' && '완료'}
                {f.status === 'error' && '실패'}
                {f.status === 'uploading' && `${f.progress}%`}
                {f.status === 'pending' && '대기'}
              </span>
              {f.status === 'pending' && (
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isUploading}>
          이전
        </Button>
        <Button
          onClick={uploadAll}
          disabled={isUploading}
          data-testid={files.length === 0 ? 'step2-skip' : 'step2-upload'}
        >
          {isUploading
            ? '업로드 중...'
            : files.length === 0
              ? '건너뛰기'
              : '업로드 후 다음'}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: 확인 ─────────────────────────────────────────────────────────────
function Step3({
  vehicleData,
  caseItem,
  onSubmit,
  onBack,
  isLoading,
}: {
  vehicleData: VehicleForm;
  caseItem: CaseItem;
  onSubmit: () => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const rows = [
    { label: '케이스번호', value: caseItem.caseNo },
    { label: '제조사', value: vehicleData.vehicleMaker },
    { label: '모델명', value: vehicleData.vehicleModel },
    { label: '연식', value: `${vehicleData.vehicleYear}년` },
    { label: 'VIN', value: vehicleData.vin },
    { label: '현재 상태', value: 'DRAFT' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(({ label, value }) => (
              <tr key={label} className="border-b last:border-0">
                <td className="w-32 px-4 py-3 font-medium text-muted-foreground">
                  {label}
                </td>
                <td className="px-4 py-3 font-mono">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        위 내용으로 케이스를 제출하시겠습니까? 제출 후 상태가 SUBMITTED로 변경됩니다.
      </p>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          이전
        </Button>
        <Button onClick={onSubmit} disabled={isLoading} data-testid="step3-submit">
          {isLoading ? '제출 중...' : '케이스 제출'}
        </Button>
      </div>
    </div>
  );
}

// ─── 메인 위저드 ──────────────────────────────────────────────────────────────
export default function NewCasePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [vehicleData, setVehicleData] = useState<VehicleForm | null>(null);
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Step 1 완료: 케이스 생성 (DRAFT)
  async function onStep1Next(values: VehicleForm) {
    setIsCreating(true);
    try {
      const created = await createCase(values);
      setVehicleData(values);
      setCaseItem(created);
      setStep(2);
    } catch {
      toast({ variant: 'destructive', title: '케이스 생성 실패' });
    } finally {
      setIsCreating(false);
    }
  }

  // Step 3: 제출 (DRAFT → SUBMITTED)
  async function onFinalSubmit() {
    if (!caseItem) return;
    setIsSubmitting(true);
    try {
      await submitCase(caseItem.id);
      toast({ title: '케이스 제출 완료', description: caseItem.caseNo });
      router.push(`/cases/${caseItem.id}`);
    } catch {
      toast({ variant: 'destructive', title: '제출 실패' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">새 케이스 등록</h2>

      <StepIndicator current={step} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {step === 1 && '차량 정보 입력'}
            {step === 2 && '관련 파일 첨부'}
            {step === 3 && '최종 확인'}
          </CardTitle>
        </CardHeader>
        <CardContent data-testid="wizard-step" data-step={step}>
          {step === 1 && (
            <Step1 onNext={onStep1Next} isLoading={isCreating} />
          )}
          {step === 2 && caseItem && (
            <Step2
              caseId={caseItem.id}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 2 && !caseItem && (
            <div data-testid="step2-loading" className="py-8 text-center text-muted-foreground">
              케이스 생성 중...
            </div>
          )}
          {step === 3 && vehicleData && caseItem && (
            <Step3
              vehicleData={vehicleData}
              caseItem={caseItem}
              onSubmit={onFinalSubmit}
              onBack={() => setStep(2)}
              isLoading={isSubmitting}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
