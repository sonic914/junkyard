// ─── Case ────────────────────────────────────────────────────────────────────

export type CaseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'GRADING'
  | 'ON_SALE'
  | 'SOLD'
  | 'SETTLED'
  | 'CANCELLED';

export interface CaseItem {
  id: string;
  caseNo: string;
  status: CaseStatus;
  vehicleMaker: string;
  vehicleModel: string;
  vehicleYear: number;
  vin: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  org?: { id: string; name: string };
}

export interface CaseListResponse {
  items: CaseItem[];
  total: number;
  page: number;
  limit: number;
}

// ─── Settlement ───────────────────────────────────────────────────────────────

export type SettlementType = 'M0' | 'DELTA';
export type SettlementStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface Settlement {
  id: string;
  caseId: string;
  caseNo?: string;
  type: SettlementType;
  status: SettlementStatus;
  amount: number;
  partType?: string;
  approvedAt?: string;
  paidAt?: string;
  rejectedAt?: string;
  createdAt: string;
}

export interface SettlementListResponse {
  items: Settlement[];
  total: number;
  page: number;
  limit: number;
}

// ─── Organization ─────────────────────────────────────────────────────────────

export type OrgType = 'PLATFORM' | 'JUNKYARD' | 'HUB' | 'BUYER';

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  bizNo: string;
  createdAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'ADMIN'
  | 'OWNER'
  | 'JUNKYARD'
  | 'INTAKE_JUNKYARD'
  | 'HUB'
  | 'BUYER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
  org?: { id: string; name: string; type: string };
  createdAt: string;
}

// ─── GradingRule ──────────────────────────────────────────────────────────────

export interface GradingRule {
  id: string;
  partType: string;
  reuseConditions: Record<string, unknown>;
  recycleConditions: Record<string, unknown>;
  version: number;
  isActive: boolean;
  createdAt: string;
}

// ─── SettlementRule ───────────────────────────────────────────────────────────

export interface SettlementRule {
  id: string;
  partType: string;
  m0BaseAmount: number;
  deltaRatio: number;
  version: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCases: number;
  activeCases: number;
  pendingSettlements: number;
  monthlySettlementAmount: number;
  caseStatusDistribution: Array<{ status: CaseStatus; count: number }>;
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
  }>;
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  id: string;
  caseId: string;
  caseNo?: string;
  eventType: string;
  payload: Record<string, unknown>;
  hash: string;
  prevHash: string | null;
  createdAt: string;
}

export interface LedgerVerifyResult {
  valid: boolean;
  totalEntries: number;
  invalidEntries: Array<{ id: string; reason: string }>;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
}
