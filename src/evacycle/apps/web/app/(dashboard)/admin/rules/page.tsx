'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getGradingRules,
  createGradingRule,
  updateGradingRule,
  getSettlementRules,
  createSettlementRule,
  updateSettlementRule,
} from '@/lib/api/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Plus, Pencil } from 'lucide-react';
import type { GradingRule, SettlementRule } from '@/types';

// ─── Settlement Rule 스키마 ───────────────────────────────────────────────────
const settlementRuleSchema = z.object({
  partType: z.string().min(1, 'PartType을 입력하세요'),
  m0BaseAmount: z.coerce.number().min(0, '0 이상'),
  deltaRatio: z.coerce.number().min(0).max(100, '0~100'),
});
type SettlementRuleForm = z.infer<typeof settlementRuleSchema>;

// ─── Grading Rule 스키마 ─────────────────────────────────────────────────────
const gradingRuleSchema = z.object({
  partType: z.string().min(1, 'PartType을 입력하세요'),
  version: z.coerce.number().min(1),
});
type GradingRuleForm = z.infer<typeof gradingRuleSchema>;

const PART_TYPES = ['BATTERY', 'MOTOR', 'BODY', 'INVERTER', 'CHARGER'];

// ─── SettlementRule 다이얼로그 ────────────────────────────────────────────────
function SettlementRuleDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: SettlementRule | null;
}) {
  const qc = useQueryClient();

  const form = useForm<SettlementRuleForm>({
    resolver: zodResolver(settlementRuleSchema),
    values: editing
      ? {
          partType: editing.partType,
          m0BaseAmount: editing.m0BaseAmount,
          deltaRatio: editing.deltaRatio,
        }
      : { partType: '', m0BaseAmount: 0, deltaRatio: 0 },
  });

  const createMut = useMutation({
    mutationFn: createSettlementRule,
    onSuccess: () => {
      toast({ title: '정산룰 생성 완료' });
      qc.invalidateQueries({ queryKey: ['admin', 'settlement-rules'] });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: '생성 실패' }),
  });

  const updateMut = useMutation({
    mutationFn: (body: SettlementRuleForm) =>
      updateSettlementRule(editing!.id, body),
    onSuccess: () => {
      toast({ title: '정산룰 수정 완료' });
      qc.invalidateQueries({ queryKey: ['admin', 'settlement-rules'] });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: '수정 실패' }),
  });

  function onSubmit(values: SettlementRuleForm) {
    if (editing) updateMut.mutate(values);
    else createMut.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? '정산룰 수정' : '정산룰 추가'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="partType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PartType</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="예: BATTERY"
                      list="part-types"
                      disabled={!!editing}
                      {...field}
                    />
                  </FormControl>
                  <datalist id="part-types">
                    {PART_TYPES.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="m0BaseAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>M0 기본금액 (원)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="deltaRatio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delta 비율 (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} step={0.1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>취소</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editing ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── GradingRule 다이얼로그 ──────────────────────────────────────────────────
function GradingRuleDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: GradingRule | null;
}) {
  const qc = useQueryClient();

  const form = useForm<GradingRuleForm>({
    resolver: zodResolver(gradingRuleSchema),
    values: editing
      ? { partType: editing.partType, version: editing.version }
      : { partType: '', version: 1 },
  });

  const createMut = useMutation({
    mutationFn: (values: GradingRuleForm) =>
      createGradingRule({
        ...values,
        reuseConditions: {},
        recycleConditions: {},
        isActive: true,
      }),
    onSuccess: () => {
      toast({ title: '그레이딩룰 생성 완료' });
      qc.invalidateQueries({ queryKey: ['admin', 'grading-rules'] });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: '생성 실패' }),
  });

  const updateMut = useMutation({
    mutationFn: (values: GradingRuleForm) =>
      updateGradingRule(editing!.id, values),
    onSuccess: () => {
      toast({ title: '그레이딩룰 수정 완료' });
      qc.invalidateQueries({ queryKey: ['admin', 'grading-rules'] });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: '수정 실패' }),
  });

  function onSubmit(values: GradingRuleForm) {
    if (editing) updateMut.mutate(values);
    else createMut.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? '그레이딩룰 수정' : '그레이딩룰 추가'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="partType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PartType</FormLabel>
                  <FormControl>
                    <Input placeholder="예: BATTERY" disabled={!!editing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>버전</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>취소</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editing ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function AdminRulesPage() {
  const [settlementDialog, setSettlementDialog] = useState(false);
  const [gradingDialog, setGradingDialog] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<SettlementRule | null>(null);
  const [editingGrading, setEditingGrading] = useState<GradingRule | null>(null);

  const { data: settlementRules, isLoading: srLoading } = useQuery({
    queryKey: ['admin', 'settlement-rules'],
    queryFn: getSettlementRules,
  });

  const { data: gradingRules, isLoading: grLoading } = useQuery({
    queryKey: ['admin', 'grading-rules'],
    queryFn: getGradingRules,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">룰 관리</h2>

      <Tabs defaultValue="settlement">
        <TabsList>
          <TabsTrigger value="settlement">정산 룰</TabsTrigger>
          <TabsTrigger value="grading">그레이딩 룰</TabsTrigger>
        </TabsList>

        {/* 정산 룰 */}
        <TabsContent value="settlement" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>정산 룰</CardTitle>
              <Button
                size="sm"
                onClick={() => { setEditingSettlement(null); setSettlementDialog(true); }}
              >
                <Plus className="mr-2 h-4 w-4" /> 룰 추가
              </Button>
            </CardHeader>
            <CardContent>
              {srLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PartType</TableHead>
                      <TableHead className="text-right">M0 기본금액</TableHead>
                      <TableHead className="text-right">Delta 비율</TableHead>
                      <TableHead>버전</TableHead>
                      <TableHead>활성</TableHead>
                      <TableHead>수정일</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlementRules?.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.partType}</TableCell>
                        <TableCell className="text-right">
                          {rule.m0BaseAmount.toLocaleString('ko-KR')}원
                        </TableCell>
                        <TableCell className="text-right">{rule.deltaRatio}%</TableCell>
                        <TableCell>v{rule.version}</TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(rule.createdAt), 'yy.MM.dd')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingSettlement(rule); setSettlementDialog(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 그레이딩 룰 */}
        <TabsContent value="grading" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>그레이딩 룰</CardTitle>
              <Button
                size="sm"
                onClick={() => { setEditingGrading(null); setGradingDialog(true); }}
              >
                <Plus className="mr-2 h-4 w-4" /> 룰 추가
              </Button>
            </CardHeader>
            <CardContent>
              {grLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PartType</TableHead>
                      <TableHead>버전</TableHead>
                      <TableHead>활성</TableHead>
                      <TableHead>등록일</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradingRules?.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.partType}</TableCell>
                        <TableCell>v{rule.version}</TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(rule.createdAt), 'yy.MM.dd')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingGrading(rule); setGradingDialog(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SettlementRuleDialog
        open={settlementDialog}
        onClose={() => setSettlementDialog(false)}
        editing={editingSettlement}
      />
      <GradingRuleDialog
        open={gradingDialog}
        onClose={() => setGradingDialog(false)}
        editing={editingGrading}
      />
    </div>
  );
}
