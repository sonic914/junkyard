'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '@/lib/api/admin';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText,
  Activity,
  Clock,
  DollarSign,
} from 'lucide-react';
import type { CaseStatus } from '@/types';

// ─── 상태별 색상 ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Partial<Record<CaseStatus, string>> = {
  DRAFT:      '#94a3b8',
  SUBMITTED:  '#60a5fa',
  IN_TRANSIT: '#34d399',
  RECEIVED:   '#a78bfa',
  GRADING:    '#fb923c',
  ON_SALE:    '#f59e0b',
  SOLD:       '#10b981',
  SETTLED:    '#1E40AF',
  CANCELLED:  '#ef4444',
};

const STATUS_LABELS: Partial<Record<CaseStatus, string>> = {
  DRAFT:      '초안',
  SUBMITTED:  '제출됨',
  IN_TRANSIT: '운송중',
  RECEIVED:   '입고됨',
  GRADING:    '감정중',
  ON_SALE:    '판매중',
  SOLD:       '판매완료',
  SETTLED:    '정산완료',
  CANCELLED:  '취소됨',
};

// ─── KPI 카드 ─────────────────────────────────────────────────────────────────
function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getDashboard,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">대시보드</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        데이터를 불러오는 데 실패했습니다
      </div>
    );
  }

  const chartData = data.caseStatusDistribution.map((item) => ({
    name: STATUS_LABELS[item.status] ?? item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] ?? '#94a3b8',
  }));

  const monthlyAmount = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(data.monthlySettlementAmount);

  return (
    <div className="space-y-6" data-theme="b">
      <h2 className="text-2xl font-bold tracking-tight">대시보드</h2>

      {/* KPI 카드 4종 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="전체 케이스"
          value={data.totalCases.toLocaleString()}
          icon={FileText}
          sub="전체 등록 케이스"
        />
        <KpiCard
          title="진행중"
          value={data.activeCases.toLocaleString()}
          icon={Activity}
          sub="SUBMITTED ~ ON_SALE"
        />
        <KpiCard
          title="정산 대기"
          value={data.pendingSettlements.toLocaleString()}
          icon={Clock}
          sub="PENDING 상태 정산건"
        />
        <KpiCard
          title="이번달 정산액"
          value={monthlyAmount}
          icon={DollarSign}
          sub="이번달 PAID 합계"
        />
      </div>

      {/* 차트 + 활동 피드 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 도넛 차트 */}
        <Card>
          <CardHeader>
            <CardTitle>케이스 상태 분포</CardTitle>
            <CardDescription>현재 케이스 상태별 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value}건`,
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 최근 활동 피드 */}
        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
            <CardDescription>시스템 이벤트 최근 목록</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentActivities.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  최근 활동이 없습니다
                </p>
              )}
              {data.recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 border-b pb-3 last:border-0"
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
