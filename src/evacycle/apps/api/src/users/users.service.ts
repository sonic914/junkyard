import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Prisma } from '@prisma/client';
import { paginate, toSkipTake } from '../common/dto/paginated-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ID로 유저 조회
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`유저를 찾을 수 없습니다: ${id}`);
    }

    return user;
  }

  /**
   * 이메일로 유저 조회
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 마지막 로그인 시각 업데이트
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * 유저 목록 조회 (관리자용)
   */
  async findAll(params?: {
    orgId?: string;
    role?: UserRole;
    skip?: number;
    take?: number;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.UserWhereInput = {
      ...(params?.orgId && { orgId: params.orgId }),
      ...(params?.role && { role: params.role }),
    };

    const { skip, take } = toSkipTake(params ?? {});

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          orgId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, params ?? {});
  }
}
