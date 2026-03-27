import apiClient from './client';
import type { CaseItem, CaseListResponse, PaginationParams } from '@/types';

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
