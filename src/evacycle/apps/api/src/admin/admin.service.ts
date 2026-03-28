import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-org.dto';
import { UpdateOrganizationDto } from './dto/update-org.dto';
import { CreateGradingRuleDto } from './dto/create-grading-rule.dto';
import { AdminUpdateUserDto } from './dto/update-user.dto';
import { QueryLedgerDto } from './dto/query-ledger.dto';
import { OrgType, PartType, UserRole, Prisma, EventType } from '@prisma/client';
import { computeSelfHash } from '../ledger/hash.util';
import { paginate } from '../common/dto/paginated-response.dto';

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
    return paginate(data, total, { skip, take });
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

  // ── GradingRule CRUD (CP3) ──

  async createGradingRule(dto: CreateGradingRuleDto) {
    return this.prisma.$transaction(async (tx) => {
      // 동일 partType의 최신 버전 조회
      const latest = await tx.gradingRule.findFirst({
        where: { partType: dto.partType },
        orderBy: { version: 'desc' },
      });

      const newVersion = (latest?.version ?? 0) + 1;

      // 기존 활성 규칙 비활성화
      if (latest?.isActive) {
        await tx.gradingRule.updateMany({
          where: { partType: dto.partType, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.gradingRule.create({
        data: {
          partType: dto.partType,
          reuseConditions: dto.reuseConditions,
          recycleConditions: dto.recycleConditions,
          version: newVersion,
          isActive: true,
        },
      });
    });
  }

  async findAllGradingRules(partType?: PartType, activeOnly = true) {
    const where: any = {};
    if (partType) where.partType = partType;
    if (activeOnly) where.isActive = true;

    return this.prisma.gradingRule.findMany({
      where,
      orderBy: [{ partType: 'asc' }, { version: 'desc' }],
    });
  }

  // ── CP4: 대시보드 ──

  async getDashboard() {
    const [
      casesByStatus,
      lotsByStatus,
      lotsByPartType,
      settlementsByStatus,
      settlementAmounts,
      usersByRole,
    ] = await Promise.all([
      this.prisma.vehicleCase.groupBy({ by: ['status'], _count: true }),
      this.prisma.derivedLot.groupBy({ by: ['status'], _count: true }),
      this.prisma.derivedLot.groupBy({ by: ['partType'], _count: true }),
      this.prisma.newSettlement.groupBy({ by: ['status'], _count: true }),
      this.prisma.newSettlement.groupBy({
        by: ['status'],
        _sum: { amount: true },
      }),
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
    ]);

    const amountMap = Object.fromEntries(
      settlementAmounts.map((g) => [
        g.status,
        g._sum.amount?.toString() ?? '0',
      ]),
    );

    return {
      cases: {
        total: casesByStatus.reduce((sum, g) => sum + g._count, 0),
        byStatus: Object.fromEntries(
          casesByStatus.map((g) => [g.status, g._count]),
        ),
      },
      lots: {
        total: lotsByStatus.reduce((sum, g) => sum + g._count, 0),
        byStatus: Object.fromEntries(
          lotsByStatus.map((g) => [g.status, g._count]),
        ),
        byPartType: Object.fromEntries(
          lotsByPartType.map((g) => [g.partType, g._count]),
        ),
      },
      settlements: {
        total: settlementsByStatus.reduce((sum, g) => sum + g._count, 0),
        byStatus: Object.fromEntries(
          settlementsByStatus.map((g) => [g.status, g._count]),
        ),
        totalAmountPending: amountMap['PENDING'] ?? '0',
        totalAmountApproved: amountMap['APPROVED'] ?? '0',
        totalAmountPaid: amountMap['PAID'] ?? '0',
      },
      users: {
        total: usersByRole.reduce((sum, g) => sum + g._count, 0),
        byRole: Object.fromEntries(
          usersByRole.map((g) => [g.role, g._count]),
        ),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ── CP4: 사용자 관리 ──

  async findAllUsers(
    role?: UserRole,
    search?: string,
    skip = 0,
    take = 20,
  ) {
    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          org: { select: { id: true, name: true } },
          _count: { select: { createdCases: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // 각 사용자의 정산 합계
    const userIds = items.map((u) => u.id);
    const settlementTotals = await this.prisma.newSettlement.groupBy({
      by: ['yardUserId'],
      where: { yardUserId: { in: userIds } },
      _sum: { amount: true },
    });
    const totalMap = Object.fromEntries(
      settlementTotals.map((s) => [
        s.yardUserId,
        s._sum.amount?.toString() ?? '0',
      ]),
    );

    return paginate(
      items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        orgId: u.orgId,
        orgName: u.org.name,
        isActive: u.isActive,
        createdAt: u.createdAt,
        stats: {
          casesCount: u._count.createdCases,
          settlementsTotal: totalMap[u.id] ?? '0',
        },
      })),
      total,
      { skip, take },
    );
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.name !== undefined && { name: dto.name }),
      },
    });
  }

  // ── CP4: 원장 조회 ──

  async findAllLedgerEvents(query: QueryLedgerDto) {
    const where: Prisma.EventLedgerWhereInput = {
      ...(query.caseId && { caseId: query.caseId }),
      ...(query.eventType && { eventType: query.eventType }),
      ...(query.actorId && { actorId: query.actorId }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.eventLedger.findMany({
        where,
        include: {
          case: { select: { caseNo: true } },
          actor: { select: { id: true, name: true } },
        },
        skip: query.skip ?? 0,
        take: query.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.eventLedger.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        seq: e.seq,
        caseId: e.caseId,
        caseNo: e.case.caseNo,
        eventType: e.eventType,
        actorId: e.actorId,
        actorName: e.actor.name,
        payload: e.payload,
        prevHash: e.prevHash,
        selfHash: e.selfHash,
        createdAt: e.createdAt,
      })),
      total,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    };
  }

  // ── CP4: 원장 검증 ──

  async verifyLedger(caseId?: string) {
    const where = caseId ? { caseId } : {};
    const events = await this.prisma.eventLedger.findMany({
      where,
      include: { case: { select: { caseNo: true } } },
      orderBy: [{ caseId: 'asc' }, { seq: 'asc' }],
    });

    const errors: Array<{
      caseId: string;
      caseNo: string;
      seq: number;
      expectedHash: string;
      actualHash: string;
      eventType: string;
    }> = [];
    let currentCaseId: string | null = null;
    let prevHash: string | null = null;
    const casesVerified = new Set<string>();

    for (const event of events) {
      casesVerified.add(event.caseId);

      if (event.caseId !== currentCaseId) {
        currentCaseId = event.caseId;
        prevHash = null; // 새 Case 체인 시작
      }

      // prevHash 일치 검증
      const expectedPrevHash = prevHash ?? '0'.repeat(64);
      if (event.prevHash !== expectedPrevHash) {
        errors.push({
          caseId: event.caseId,
          caseNo: event.case.caseNo,
          seq: event.seq,
          expectedHash: expectedPrevHash,
          actualHash: event.prevHash,
          eventType: event.eventType,
        });
      }

      // selfHash 재계산 검증
      const computed = computeSelfHash({
        caseId: event.caseId,
        seq: event.seq,
        eventType: event.eventType,
        actorId: event.actorId,
        prevHash: event.prevHash,
        payload: event.payload as Record<string, unknown>,
        createdAt: event.createdAt,
      });
      if (event.selfHash !== computed) {
        errors.push({
          caseId: event.caseId,
          caseNo: event.case.caseNo,
          seq: event.seq,
          expectedHash: computed,
          actualHash: event.selfHash,
          eventType: event.eventType,
        });
      }

      prevHash = event.selfHash;
    }

    return {
      valid: errors.length === 0,
      eventsVerified: events.length,
      casesVerified: casesVerified.size,
      ...(errors.length > 0 && { errors }),
      verifiedAt: new Date().toISOString(),
    };
  }

  // ── CP4: 감사용 Case 조회 ──

  async findCaseForAudit(caseId: string) {
    return this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
      select: { id: true, caseNo: true, status: true },
    });
  }

  // ── CP5: 전체 해시 체인 일괄 검증 ──

  async verifyAllChains(): Promise<{
    totalCases: number;
    validCases: number;
    invalidCases: Array<{ caseId: string; caseNo: string; brokenAt: number }>;
    verifiedAt: string;
  }> {
    const cases = await this.prisma.vehicleCase.findMany({
      select: { id: true, caseNo: true },
    });

    const invalidCases: Array<{
      caseId: string;
      caseNo: string;
      brokenAt: number;
    }> = [];

    for (const c of cases) {
      const result = await this.verifyLedger(c.id);
      if (!result.valid) {
        // errors 배열에서 첫 번째 broken seq 추출
        const firstError = (result as any).errors?.[0];
        invalidCases.push({
          caseId: c.id,
          caseNo: c.caseNo,
          brokenAt: firstError?.seq ?? 0,
        });
      }
    }

    return {
      totalCases: cases.length,
      validCases: cases.length - invalidCases.length,
      invalidCases,
      verifiedAt: new Date().toISOString(),
    };
  }
}
