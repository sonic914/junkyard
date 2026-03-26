import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-org.dto';
import { UpdateOrganizationDto } from './dto/update-org.dto';
import { OrgType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: {
        name: dto.name,
        type: dto.type,
        bizNo: dto.businessNo,
        address: dto.address,
        phone: dto.phone,
      },
    });
  }

  async findAllOrganizations(type?: OrgType, skip = 0, take = 20) {
    const where = type ? { type } : {};
    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOneOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        _count: {
          select: {
            ownedCases: true,
            intakeCases: true,
            hubCases: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.businessNo !== undefined && { bizNo: dto.businessNo }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
    });
  }

  async deleteOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org._count.users > 0) {
      throw new ConflictException(
        '소속 유저가 존재합니다. 먼저 유저를 이동하거나 삭제해주세요.',
      );
    }

    return this.prisma.organization.delete({ where: { id } });
  }
}
