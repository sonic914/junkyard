import apiClient from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReuseGrade = 'A' | 'B' | 'C' | 'D';
export type RecycleGrade = 'R1' | 'R2' | 'R3';
export type RoutingDecision = 'REUSE' | 'RECYCLE' | 'DISCARD';
export type LotStatus = 'AVAILABLE' | 'LISTED' | 'SOLD' | 'DISCARDED';

export interface GradingResult {
  id: string;
  caseId: string;
  partType: string;
  reuseGrade: ReuseGrade;
  recycleGrade: RecycleGrade;
  routingDecision: RoutingDecision;
  notes?: string;
  gradedAt: string;
}

export interface Listing {
  id: string;
  lotId: string;
  price: number;
  status: 'OPEN' | 'SOLD' | 'CANCELLED';
  createdAt: string;
}

export interface Lot {
  id: string;
  lotNo: string;
  caseId: string;
  caseNo?: string;
  partType: string;
  status: LotStatus;
  reuseGrade?: ReuseGrade;
  recycleGrade?: RecycleGrade;
  routingDecision?: RoutingDecision;
  listing?: Listing;
  createdAt: string;
}

export interface GradeBody {
  partType: string;
  reuseGrade: ReuseGrade;
  recycleGrade: RecycleGrade;
  routingDecision: RoutingDecision;
  notes?: string;
}

export interface CreateListingBody {
  price: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function getLots(params?: {
  status?: LotStatus;
  caseId?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: Lot[]; total: number }> {
  const { data } = await apiClient.get('/lots', { params });
  return data;
}

export async function getLot(id: string): Promise<Lot> {
  const { data } = await apiClient.get<Lot>(`/lots/${id}`);
  return data;
}

export async function gradeCase(
  caseId: string,
  body: GradeBody,
): Promise<GradingResult> {
  const { data } = await apiClient.post<GradingResult>(
    `/cases/${caseId}/gradings`,
    body,
  );
  return data;
}

export async function createListing(
  lotId: string,
  body: CreateListingBody,
): Promise<Listing> {
  const { data } = await apiClient.post<Listing>(
    `/lots/${lotId}/listings`,
    body,
  );
  return data;
}

export async function intakeConfirm(caseId: string): Promise<unknown> {
  const { data } = await apiClient.post(`/cases/${caseId}/transition`, {
    eventType: 'INTAKE_CONFIRMED',
    payload: { confirmedAt: new Date().toISOString() },
  });
  return data;
}
