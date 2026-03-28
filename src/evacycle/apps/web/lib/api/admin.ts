import apiClient from './client';
import type {
  DashboardStats,
  Settlement,
  SettlementListResponse,
  Organization,
  OrgType,
  User,
  UserRole,
  GradingRule,
  SettlementRule,
  LedgerEntry,
  LedgerVerifyResult,
  PaginationParams,
} from '@/types';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>('/admin/dashboard');
  return data;
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export async function getAdminSettlements(
  params?: PaginationParams & { caseId?: string },
): Promise<SettlementListResponse> {
  // 백엔드: { data: Settlement[], meta: { total, ... } } → 정규화
  const { data } = await apiClient.get<any>('/admin/settlements', { params });
  if (Array.isArray(data?.items)) return data as SettlementListResponse;
  return { items: data?.data ?? data?.items ?? [], total: data?.meta?.total ?? data?.total ?? 0 };
}

export async function approveSettlement(id: string): Promise<Settlement> {
  const { data } = await apiClient.patch<Settlement>(
    `/admin/settlements/${id}/approve`,
  );
  return data;
}

export async function rejectSettlement(
  id: string,
  reason?: string,
): Promise<Settlement> {
  const { data } = await apiClient.patch<Settlement>(
    `/admin/settlements/${id}/reject`,
    { reason },
  );
  return data;
}

export async function paySettlement(id: string): Promise<Settlement> {
  const { data } = await apiClient.patch<Settlement>(
    `/admin/settlements/${id}/pay`,
  );
  return data;
}

export async function batchApproveSettlements(
  settlementIds: string[],
): Promise<{ approved: number }> {
  const { data } = await apiClient.post('/admin/settlements/batch-approve', {
    settlementIds,
  });
  return data;
}

// ─── Cases (Admin) ───────────────────────────────────────────────────────────

export async function updateAdminCase(
  id: string,
  body: { hubOrgId?: string; notes?: string },
): Promise<unknown> {
  const { data } = await apiClient.patch(`/admin/cases/${id}`, body);
  return data;
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function getOrganizations(): Promise<Organization[]> {
  // 백엔드: { data: Organization[], total, skip, take } → 배열만 반환
  const { data } = await apiClient.get<any>('/admin/organizations');
  if (Array.isArray(data)) return data as Organization[];
  return (data?.data ?? data?.items ?? []) as Organization[];
}

export async function createOrganization(body: {
  name: string;
  type: OrgType;
  bizNo: string;
}): Promise<Organization> {
  const { data } = await apiClient.post<Organization>(
    '/admin/organizations',
    body,
  );
  return data;
}

export async function updateOrganization(
  id: string,
  body: Partial<{ name: string; bizNo: string }>,
): Promise<Organization> {
  const { data } = await apiClient.patch<Organization>(
    `/admin/organizations/${id}`,
    body,
  );
  return data;
}

export async function deleteOrganization(id: string): Promise<void> {
  await apiClient.delete(`/admin/organizations/${id}`);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAdminUsers(
  params?: PaginationParams,
): Promise<{ items: User[]; total: number }> {
  const { data } = await apiClient.get('/admin/users', { params });
  return data;
}

export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<User> {
  const { data } = await apiClient.patch<User>(`/admin/users/${id}`, { role });
  return data;
}

// ─── GradingRules ─────────────────────────────────────────────────────────────

export async function getGradingRules(): Promise<GradingRule[]> {
  const { data } = await apiClient.get<GradingRule[]>('/admin/grading-rules');
  return data;
}

export async function createGradingRule(
  body: Omit<GradingRule, 'id' | 'createdAt'>,
): Promise<GradingRule> {
  const { data } = await apiClient.post<GradingRule>(
    '/admin/grading-rules',
    body,
  );
  return data;
}

export async function updateGradingRule(
  id: string,
  body: Partial<GradingRule>,
): Promise<GradingRule> {
  const { data } = await apiClient.patch<GradingRule>(
    `/admin/grading-rules/${id}`,
    body,
  );
  return data;
}

// ─── SettlementRules ──────────────────────────────────────────────────────────

export async function getSettlementRules(): Promise<SettlementRule[]> {
  const { data } = await apiClient.get<SettlementRule[]>(
    '/admin/settlement-rules',
  );
  return data;
}

export async function createSettlementRule(body: {
  partType: string;
  m0BaseAmount: number;
  deltaRatio: number;
}): Promise<SettlementRule> {
  const { data } = await apiClient.post<SettlementRule>(
    '/admin/settlement-rules',
    body,
  );
  return data;
}

export async function updateSettlementRule(
  id: string,
  body: Partial<SettlementRule>,
): Promise<SettlementRule> {
  const { data } = await apiClient.patch<SettlementRule>(
    `/admin/settlement-rules/${id}`,
    body,
  );
  return data;
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export async function getLedger(params?: {
  caseId?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: LedgerEntry[]; total: number }> {
  const { data } = await apiClient.get('/admin/ledger', { params });
  return data;
}

export async function verifyAllChains(): Promise<LedgerVerifyResult> {
  const { data } =
    await apiClient.get<LedgerVerifyResult>('/admin/ledger/verify-all');
  return data;
}
