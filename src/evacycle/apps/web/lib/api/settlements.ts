import apiClient from './client';
import type { SettlementListResponse, PaginationParams } from '@/types';

/** 내 정산 내역 (폐차장 본인)
 *  백엔드: { data: Settlement[], meta: { total } } → SettlementListResponse 정규화
 */
export async function getMySettlements(
  params?: PaginationParams,
): Promise<SettlementListResponse> {
  const { data } = await apiClient.get<any>('/settlements', { params });
  if (Array.isArray(data?.items)) return data as SettlementListResponse;
  return {
    items: data?.data ?? data?.items ?? [],
    total: data?.meta?.total ?? data?.total ?? 0,
  };
}
