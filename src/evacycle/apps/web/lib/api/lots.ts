import apiClient from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReuseGrade = 'A' | 'B' | 'C' | 'D';
export type RecycleGrade = 'R1' | 'R2' | 'R3';
export type RoutingDecision = 'REUSE' | 'RECYCLE' | 'DISCARD';
export type LotStatus = 'PENDING' | 'ON_SALE' | 'SOLD' | 'SETTLED';

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
  status: 'DRAFT' | 'ACTIVE' | 'OPEN' | 'SOLD' | 'CANCELLED';
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

export interface CreateLotBody {
  partType: string;
  weightKg: number;
  quantity?: number;
  description?: string;
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
}): Promise<{ items: Lot[]; total: number; page: number; limit: number }> {
  // COD-27: PaginatedResponse<T> → { data, total, page, limit, totalPages }
  const { data } = await apiClient.get<any>('/lots', { params });
  return { items: data?.data ?? [], total: data?.total ?? 0, page: data?.page ?? 1, limit: data?.limit ?? 20 };
}

export async function getLot(id: string): Promise<Lot> {
  const { data } = await apiClient.get<Lot>(`/lots/${id}`);
  return data;
}

export async function gradeCase(
  caseId: string,
  body: GradeBody,
): Promise<GradingResult> {
  // 백엔드: @Controller('cases/:id/grade') + @Post() → POST /cases/:id/grade
  const { data } = await apiClient.post<GradingResult>(
    `/cases/${caseId}/grade`,
    body,
  );
  return data;
}

export async function createLot(
  caseId: string,
  body: CreateLotBody,
): Promise<Lot> {
  // 백엔드: POST /cases/:id/lots
  const { data } = await apiClient.post<Lot>(`/cases/${caseId}/lots`, body);
  return data;
}

export async function createListing(
  lotId: string,
  body: CreateListingBody,
): Promise<Listing> {
  // 백엔드: @Post('lots/:id/list') → POST /lots/:id/list
  const { data } = await apiClient.post<Listing>(
    `/lots/${lotId}/list`,
    body,
  );
  return data;
}

export async function intakeConfirm(
  caseId: string,
  receivedBy: string,
): Promise<unknown> {
  // 백엔드: POST /cases/:id/events/transition
  const { data } = await apiClient.post(`/cases/${caseId}/events/transition`, {
    eventType: 'INTAKE_CONFIRMED',
    payload: {
      receivedBy,
      receivedAt: new Date().toISOString(),
    },
  });
  return data;
}
