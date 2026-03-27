import apiClient from './client';
import type { CaseItem, CaseListResponse, PaginationParams } from '@/types';

export interface CreateCaseBody {
  vehicleMaker: string;
  vehicleModel: string;
  vehicleYear: number;
  vin: string;
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  hash: string;
  prevHash: string | null;
  hashValid?: boolean;
  createdAt: string;
}

export interface TimelineResponse {
  caseId: string;
  caseNo: string;
  timeline: TimelineEvent[];
}

export async function getCases(
  params?: PaginationParams & { status?: string },
): Promise<CaseListResponse> {
  const { data } = await apiClient.get<CaseListResponse>('/cases', { params });
  return data;
}

export async function getCase(id: string): Promise<CaseItem> {
  const { data } = await apiClient.get<CaseItem>(`/cases/${id}`);
  return data;
}

export async function createCase(body: CreateCaseBody): Promise<CaseItem> {
  const { data } = await apiClient.post<CaseItem>('/cases', body);
  return data;
}

export async function submitCase(id: string): Promise<CaseItem> {
  const { data } = await apiClient.post<CaseItem>(`/cases/${id}/submit`);
  return data;
}

export async function cancelCase(id: string): Promise<CaseItem> {
  const { data } = await apiClient.post<CaseItem>(`/cases/${id}/cancel`);
  return data;
}

export async function transitionCase(
  id: string,
  eventType: string,
  payload?: Record<string, unknown>,
): Promise<CaseItem> {
  const { data } = await apiClient.post<CaseItem>(`/cases/${id}/transition`, {
    eventType,
    payload,
  });
  return data;
}

export async function getCaseTimeline(id: string): Promise<TimelineResponse> {
  const { data } = await apiClient.get<TimelineResponse>(
    `/cases/${id}/timeline`,
  );
  return data;
}
