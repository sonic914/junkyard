import apiClient from './client';
import type { SettlementListResponse, PaginationParams } from '@/types';

/** 내 정산 내역 (폐차장 본인) */
export async function getMySettlements(
  params?: PaginationParams,
): Promise<SettlementListResponse> {
  const { data } = await apiClient.get<SettlementListResponse>('/settlements', {
    params,
  });
  return data;
}
