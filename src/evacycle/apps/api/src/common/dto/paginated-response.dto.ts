/**
 * COD-27 — 표준 페이지네이션 응답 타입 및 헬퍼
 *
 * 모든 목록 API가 이 구조를 반환합니다:
 * { data: T[], total, page, limit, totalPages }
 */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PageQuery {
  page?: number;
  limit?: number;
  /** @deprecated use page/limit */
  skip?: number;
  /** @deprecated use page/limit */
  take?: number;
}

/** page/limit → skip/take 변환 */
export function toSkipTake(query: PageQuery): { skip: number; take: number } {
  if (query.page !== undefined || query.limit !== undefined) {
    const limit = query.limit ?? 20;
    const page  = query.page  ?? 1;
    return { skip: (page - 1) * limit, take: limit };
  }
  // 레거시 skip/take 지원
  return { skip: query.skip ?? 0, take: query.take ?? 20 };
}

/** 쿼리 결과를 PaginatedResponse로 래핑 */
export function paginate<T>(
  data: T[],
  total: number,
  query: PageQuery,
): PaginatedResponse<T> {
  const { skip, take } = toSkipTake(query);
  const limit = take;
  const page  = Math.floor(skip / limit) + 1;
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
