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
import { IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/paginated-response.dto';

export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  hubOrgId?: string;

  @IsOptional()
  @IsString()
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
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
    // 레거시 skip/take 호환
    @Query('skip',  new DefaultValuePipe(-1), ParseIntPipe) skip  = -1,
    @Query('take',  new DefaultValuePipe(-1), ParseIntPipe) take  = -1,
  ) {
    const where = status ? { status: status as any } : {};

    // page/limit 우선, 레거시 skip/take fallback
    const resolvedSkip = skip >= 0 ? skip : (page - 1) * limit;
    const resolvedTake = take >= 0 ? take : limit;

    const [data, total] = await Promise.all([
      this.prisma.vehicleCase.findMany({
        where,
        include: {
          ownerOrg: { select: { id: true, name: true } },
          hubOrg:   { select: { id: true, name: true } },
          creator:  { select: { id: true, name: true } },
        },
        skip: resolvedSkip,
        take: resolvedTake,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicleCase.count({ where }),
    ]);

    return paginate(data, total, { skip: resolvedSkip, take: resolvedTake });
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
