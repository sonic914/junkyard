import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * 역할 기반 접근 제어 데코레이터
 *
 * @example
 * @Roles(UserRole.OWNER, UserRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Post('cases')
 * createCase() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
