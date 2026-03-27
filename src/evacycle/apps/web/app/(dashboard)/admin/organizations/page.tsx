'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '@/lib/api/admin';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Organization, OrgType } from '@/types';

// ─── 스키마 ───────────────────────────────────────────────────────────────────
const orgSchema = z.object({
  name: z.string().min(1, '조직명을 입력하세요'),
  type: z.enum(['PLATFORM', 'JUNKYARD', 'HUB', 'BUYER'] as const),
  bizNo: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, '사업자번호 형식: 000-00-00000'),
});

type OrgForm = z.infer<typeof orgSchema>;

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: 'PLATFORM', label: '플랫폼' },
  { value: 'JUNKYARD', label: '폐차장' },
  { value: 'HUB', label: '허브센터' },
  { value: 'BUYER', label: '구매업체' },
];

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  PLATFORM: '플랫폼',
  JUNKYARD: '폐차장',
  HUB: '허브센터',
  BUYER: '구매업체',
};

// ─── 폼 다이얼로그 ────────────────────────────────────────────────────────────
function OrgFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Organization | null;
}) {
  const qc = useQueryClient();

  const form = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    values: editing
      ? { name: editing.name, type: editing.type, bizNo: editing.bizNo }
      : { name: '', type: 'JUNKYARD', bizNo: '' },
  });

  const createMut = useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      toast({ title: '조직 생성 완료' });
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: '생성 실패' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<OrgForm> }) =>
      updateOrganization(id, body),
    onSuccess: () => {
      toast({ title: '조직 수정 완료' });
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: '수정 실패' }),
  });

  function onSubmit(values: OrgForm) {
    if (editing) {
      updateMut.mutate({ id: editing.id, body: values });
    } else {
      createMut.mutate(values);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? '조직 수정' : '조직 추가'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>조직명</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 서울폐차장" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>유형</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!!editing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ORG_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bizNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>사업자번호</FormLabel>
                  <FormControl>
                    <Input placeholder="000-00-00000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '처리중...' : editing ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function AdminOrganizationsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: getOrganizations,
  });

  const deleteMut = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      toast({ title: '조직 삭제 완료' });
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
    onError: () => toast({ variant: 'destructive', title: '삭제 실패' }),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(org: Organization) {
    setEditing(org);
    setDialogOpen(true);
  }

  function handleDelete(org: Organization) {
    if (!confirm(`"${org.name}" 조직을 삭제하시겠습니까?`)) return;
    deleteMut.mutate(org.id);
  }

  return (
    <div className="space-y-4" data-theme="b">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">조직 관리</h2>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          조직 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>조직 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>조직명</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>사업자번호</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      등록된 조직이 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{ORG_TYPE_LABELS[org.type]}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {org.bizNo}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(org.createdAt), 'yy.MM.dd')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(org)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(org)}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrgFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />
    </div>
  );
}
