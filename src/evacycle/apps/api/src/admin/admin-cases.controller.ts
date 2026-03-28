import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateCaseDto {
  @IsUUID()
  @IsOptional()
  hubOrgId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/cases')
@Roles(UserRole.ADMIN)
export class AdminCasesController {
  constructor(private readonly prisma: PrismaService) {}

  // ── 케이스 목록 (관리자용 전체) ──

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip = 0,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take = 20,
  ) {
    const where = status ? { status: status as any } : {};

    const [data, total] = await Promise.all([
      this.prisma.vehicleCase.findMany({
        where,
        include: {
          ownerOrg: { select: { id: true, name: true } },
          hubOrg:   { select: { id: true, name: true } },
          creator:  { select: { id: true, name: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicleCase.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  // ── 케이스 수정 (hubOrgId 할당 등) ──

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    const updated = await this.prisma.vehicleCase.update({
      where: { id },
      data: {
        ...(dto.hubOrgId !== undefined && { hubOrgId: dto.hubOrgId }),
        ...(dto.notes   !== undefined && { notes:   dto.notes }),
      },
      include: {
        ownerOrg: { select: { id: true, name: true } },
        hubOrg:   { select: { id: true, name: true } },
        creator:  { select: { id: true, name: true } },
      },
    });
    return updated;
  }
}
