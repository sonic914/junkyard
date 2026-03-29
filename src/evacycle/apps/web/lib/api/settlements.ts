import apiClient from './client';
import type { SettlementListResponse, PaginationParams } from '@/types';

/** 내 정산 내역 (폐차장 본인)
 *  백엔드: { data: Settlement[], meta: { total } } → SettlementListResponse 정규화
 */
export async function getMySettlements(
  params?: PaginationParams,
): Promise<SettlementListResponse> {
  // COD-27: PaginatedResponse<T> → { data, total, page, limit, totalPages }
  const { data } = await apiClient.get<any>('/settlements', { params });
  return { items: data?.data ?? [], total: data?.total ?? 0, page: data?.page ?? 1, limit: data?.limit ?? 20 };
}
