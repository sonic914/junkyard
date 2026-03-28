import apiClient from './client';
import type { Lot } from '@/lib/api/lots';

export interface MarketplaceLot extends Lot {
  listing: {
    id: string;
    lotId: string;
    price: number;
    status: 'OPEN' | 'SOLD' | 'CANCELLED';
    createdAt: string;
  };
}

export interface PurchaseResult {
  orderId: string;
  lotId: string;
  lotNo: string;
  price: number;
  purchasedAt: string;
}

export interface Order {
  id: string;
  lotId: string;
  lotNo: string;
  partType: string;
  price: number;
  status: 'COMPLETED' | 'CANCELLED';
  purchasedAt: string;
  reuseGrade?: string;
  recycleGrade?: string;
  caseNo?: string;
}

export async function getMarketplaceLots(params?: {
  partType?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'created_desc';
  page?: number;
  limit?: number;
}): Promise<{ items: MarketplaceLot[]; total: number }> {
  // COD-27: PaginatedResponse<T>
  const { data } = await apiClient.get<any>('/lots', {
    params: { ...params, status: 'LISTED' },
  });
  return { items: data?.data ?? [], total: data?.total ?? 0 };
}

export async function getMarketplaceLot(id: string): Promise<MarketplaceLot> {
  const { data } = await apiClient.get<MarketplaceLot>(`/lots/${id}`);
  return data;
}

export async function purchaseLot(lotId: string): Promise<PurchaseResult> {
  const { data } = await apiClient.post<PurchaseResult>(
    `/lots/${lotId}/purchase`,
  );
  return data;
}

export async function getMyOrders(params?: {
  page?: number;
  limit?: number;
}): Promise<{ items: Order[]; total: number }> {
  const { data } = await apiClient.get('/marketplace/orders', { params });
  return data;
}
