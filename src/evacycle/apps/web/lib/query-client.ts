import { QueryClient } from '@tanstack/react-query';

// 싱글톤 — auth store logout에서 .clear() 호출 가능
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});
