import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, Prisma } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 이메일로 유저 조회 (비밀번호 포함 — 로그인 검증용)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * ID로 유저 조회 (비밀번호 제외)
   */
  async findById(id: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        profileImageUrl: true,
        isActive: true,
        lastLoginAt: true,
        organizationId: true,
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
   * 이메일로 유저 조회 (비밀번호 제외)
   */
  async findByEmail(email: string): Promise<UserWithoutPassword | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        profileImageUrl: true,
        isActive: true,
        lastLoginAt: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 유저 생성
   */
  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: UserRole;
    organizationId?: string;
    phone?: string;
  }): Promise<UserWithoutPassword> {
    // 이메일 중복 검사
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role ?? UserRole.VIEWER,
        organizationId: data.organizationId,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        profileImageUrl: true,
        isActive: true,
        lastLoginAt: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
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
    organizationId?: string;
    role?: UserRole;
    skip?: number;
    take?: number;
  }): Promise<{ data: UserWithoutPassword[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(params?.organizationId && { organizationId: params.organizationId }),
      ...(params?.role && { role: params.role }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: params?.skip ?? 0,
        take: params?.take ?? 20,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          profileImageUrl: true,
          isActive: true,
          lastLoginAt: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * 유저 정보 수정
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      profileImageUrl: string;
      isActive: boolean;
      role: UserRole;
    }>,
  ): Promise<UserWithoutPassword> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        profileImageUrl: true,
        isActive: true,
        lastLoginAt: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
