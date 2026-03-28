'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getLedger, verifyAllChains } from '@/lib/api/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/common/pagination';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ShieldCheck, ShieldAlert, Search, RefreshCw } from 'lucide-react';

const LIMIT = 30;

export default function AdminLedgerPage() {
  const [page, setPage] = useState(1);
  const [caseIdFilter, setCaseIdFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'ledger', { page, caseId: caseIdFilter }],
    queryFn: () =>
      getLedger({
        page,
        limit: LIMIT,
        caseId: caseIdFilter || undefined,
      }),
  });

  const verifyMut = useMutation({
    mutationFn: verifyAllChains,
    onSuccess: (result) => {
      if (result.valid) {
        toast({
          title: '✅ 해시체인 검증 통과',
          description: `전체 ${result.totalEntries}건 무결성 확인됨`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: '⚠️ 해시체인 이상 감지',
          description: `${result.invalidEntries.length}건 무결성 오류`,
        });
      }
    },
    onError: () =>
      toast({ variant: 'destructive', title: '검증 중 오류 발생' }),
  });

  const verifyResult = verifyMut.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">이벤트 원장</h2>
        <Button
          onClick={() => verifyMut.mutate()}
          disabled={verifyMut.isPending}
          variant="outline"
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          {verifyMut.isPending ? '검증 중...' : '해시체인 전체 검증'}
        </Button>
      </div>

      {/* 검증 결과 카드 */}
      {verifyResult && (
        <Card
          className={
            verifyResult.valid
              ? 'border-green-500 bg-green-50'
              : 'border-destructive bg-red-50'
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {verifyResult.valid ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">해시체인 무결성 검증 통과</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <span className="text-destructive">해시체인 이상 감지</span>
                </>
              )}
            </CardTitle>
            <CardDescription>
              전체 {verifyResult.totalEntries}건 검사
              {!verifyResult.valid &&
                ` · ${verifyResult.invalidEntries.length}건 오류`}
            </CardDescription>
          </CardHeader>
          {!verifyResult.valid && verifyResult.invalidEntries.length > 0 && (
            <CardContent>
              <ul className="space-y-1 text-sm text-destructive">
                {verifyResult.invalidEntries.map((e) => (
                  <li key={e.id}>
                    <span className="font-mono">{e.id.slice(0, 8)}</span> — {e.reason}
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* 원장 테이블 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>이벤트 목록</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Case ID 필터..."
                value={caseIdFilter}
                onChange={(e) => {
                  setCaseIdFilter(e.target.value);
                  setPage(1);
                }}
                className="w-52 pl-9"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이벤트 유형</TableHead>
                    <TableHead>케이스번호</TableHead>
                    <TableHead>해시 (앞 8자)</TableHead>
                    <TableHead>이전해시 (앞 8자)</TableHead>
                    <TableHead>일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        이벤트가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {entry.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.caseNo ?? entry.caseId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entry.hash.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entry.prevHash
                          ? `${entry.prevHash.slice(0, 8)}...`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(entry.createdAt), 'yy.MM.dd HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                page={page}
                total={data?.total ?? 0}
                limit={LIMIT}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
