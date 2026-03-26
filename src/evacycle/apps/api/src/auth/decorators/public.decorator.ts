import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 인증이 필요 없는 공개 엔드포인트 마킹
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
