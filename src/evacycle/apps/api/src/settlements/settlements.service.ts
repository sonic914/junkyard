import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  SettlementStatus,
  SettlementType,
  EventType,
  CaseStatus,
  LotStatus,
  UserRole,
  Prisma,
  PrismaClient,
  PartType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { QuerySettlementsDto } from './dto/query-settlements.dto';
import { ApproveSettlementDto } from './dto/approve-settlement.dto';
import { RejectSettlementDto } from './dto/reject-settlement.dto';
import { PaySettlementDto } from './dto/pay-settlement.dto';
import { BatchApproveDto } from './dto/batch-approve.dto';
import { CreateSettlementRuleDto } from './dto/create-settlement-rule.dto';
import { QueryAdminSettlementsDto } from '../admin/dto/query-admin-settlements.dto';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  // ── 사용자 정산 조회 ──

  async findAll(query: QuerySettlementsDto, userId: string, userRole: UserRole) {
    const where: Prisma.NewSettlementWhereInput = {
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.caseId && { caseId: query.caseId }),
    };

    if (userRole !== UserRole.ADMIN) {
      where.yardUserId = userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.newSettlement.findMany({
        where,
        include: {
          case: { select: { caseNo: true } },
          lot: { select: { lotNo: true } },
          yardUser: {
            select: {
              id: true,
              name: true,
              org: { select: { name: true } },
            },
          },
        },
        skip: query.skip ?? 0,
        take: query.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.newSettlement.count({ where }),
    ]);

    const page = Math.floor((query.skip ?? 0) / (query.take ?? 20)) + 1;
    const limit = query.take ?? 20;

    return {
      data: items.map((s) => ({
        id: s.id,
        caseId: s.caseId,
        caseNo: s.case.caseNo,
        lotId: s.lotId,
        lotNo: s.lot?.lotNo ?? null,
        type: s.type,
        status: s.status,
        grossAmount: s.grossAmount.toString(),
        feeRate: s.feeRate.toString(),
        feeAmount: s.feeAmount.toString(),
        amount: s.amount.toString(),
        currency: s.currency,
        yardUser: {
          id: s.yardUser.id,
          name: s.yardUser.name,
          orgName: s.yardUser.org?.name,
        },
        calcDetail: s.calcDetail,
        approvedBy: s.approvedBy,
        approvedAt: s.approvedAt,
        paidAt: s.paidAt,
        createdAt: s.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const settlement = await this.prisma.newSettlement.findUnique({
      where: { id },
      include: {
        case: {
          select: {
            caseNo: true,
            vehicleMaker: true,
            vehicleModel: true,
            vehicleYear: true,
          },
        },
        lot: {
          select: {
            lotNo: true,
            partType: true,
            routingDecision: true,
          },
        },
        yardUser: {
          select: {
            id: true,
            name: true,
            role: true,
            org: { select: { name: true } },
          },
        },
        approver: { select: { id: true, name: true, role: true } },
      },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    if (userRole !== UserRole.ADMIN && settlement.yardUserId !== userId) {
      throw new ForbiddenException('본인의 정산 내역만 조회할 수 있습니다');
    }

    return {
      id: settlement.id,
      caseId: settlement.caseId,
      caseNo: settlement.case.caseNo,
      lotId: settlement.lotId,
      lotNo: settlement.lot?.lotNo ?? null,
      type: settlement.type,
      status: settlement.status,
      grossAmount: settlement.grossAmount.toString(),
      feeRate: settlement.feeRate.toString(),
      feeAmount: settlement.feeAmount.toString(),
      amount: settlement.amount.toString(),
      currency: settlement.currency,
      yardUser: {
        id: settlement.yardUser.id,
        name: settlement.yardUser.name,
        orgName: (settlement.yardUser as any).org?.name,
      },
      calcDetail: settlement.calcDetail,
      ruleSnapshot: settlement.ruleSnapshot,
      triggeredByEvent: settlement.triggeredByEvent,
      notes: settlement.notes,
      approvedBy: settlement.approver,
      approvedAt: settlement.approvedAt,
      paidAt: settlement.paidAt,
      rejectedReason: settlement.rejectedReason,
      createdAt: settlement.createdAt,
      updatedAt: settlement.updatedAt,
    };
  }

  // ── Case별 정산 요약 ──

  async findCaseSettlements(caseId: string) {
    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
      select: { id: true, caseNo: true },
    });
    if (!vehicleCase) {
      throw new NotFoundException('Case not found');
    }

    const settlements = await this.prisma.newSettlement.findMany({
      where: { caseId },
      include: {
        lot: { select: { lotNo: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalGross = 0;
    let totalFee = 0;
    let totalNet = 0;
    let m0Amount = 0;
    let delta1Amount = 0;
    let delta2Amount = 0;

    const items = settlements.map((s) => {
      const net = Number(s.amount);
      const gross = Number(s.grossAmount);
      const fee = Number(s.feeAmount);
      totalGross += gross;
      totalFee += fee;
      totalNet += net;
      if (s.type === SettlementType.M0) m0Amount += net;
      if (s.type === SettlementType.DELTA_1) delta1Amount += net;
      if (s.type === SettlementType.DELTA_2) delta2Amount += net;

      return {
        id: s.id,
        type: s.type,
        lotNo: s.lot?.lotNo ?? null,
        status: s.status,
        grossAmount: s.grossAmount.toString(),
        feeAmount: s.feeAmount.toString(),
        amount: s.amount.toString(),
        approvedAt: s.approvedAt,
        paidAt: s.paidAt,
        createdAt: s.createdAt,
      };
    });

    return {
      caseId: vehicleCase.id,
      caseNo: vehicleCase.caseNo,
      summary: {
        totalGross: totalGross.toFixed(2),
        totalFee: totalFee.toFixed(2),
        totalNet: totalNet.toFixed(2),
        m0Amount: m0Amount.toFixed(2),
        delta1Amount: delta1Amount.toFixed(2),
        delta2Amount: delta2Amount.toFixed(2),
        currency: 'KRW',
      },
      settlements: items,
    };
  }

  // ── Admin 정산 관리 ──

  async findAllAdmin(query: QueryAdminSettlementsDto) {
    const where: Prisma.NewSettlementWhereInput = {
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.caseId && { caseId: query.caseId }),
      ...(query.yardUserId && { yardUserId: query.yardUserId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.newSettlement.findMany({
        where,
        include: {
          case: { select: { caseNo: true } },
          lot: { select: { lotNo: true } },
          yardUser: {
            select: {
              id: true,
              name: true,
              role: true,
              org: { select: { name: true } },
            },
          },
        },
        skip: query.skip ?? 0,
        take: query.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.newSettlement.count({ where }),
    ]);

    const page = Math.floor((query.skip ?? 0) / (query.take ?? 20)) + 1;
    const limit = query.take ?? 20;

    return {
      data: items.map((s) => ({
        id: s.id,
        caseId: s.caseId,
        caseNo: s.case.caseNo,
        lotId: s.lotId,
        lotNo: s.lot?.lotNo ?? null,
        type: s.type,
        status: s.status,
        grossAmount: s.grossAmount.toString(),
        feeRate: s.feeRate.toString(),
        feeAmount: s.feeAmount.toString(),
        amount: s.amount.toString(),
        currency: s.currency,
        yardUser: {
          id: s.yardUser.id,
          name: s.yardUser.name,
          orgName: (s.yardUser as any).org?.name,
        },
        notes: s.notes,
        approvedAt: s.approvedAt,
        paidAt: s.paidAt,
        createdAt: s.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── 정산 승인 (PENDING → APPROVED) ──

  async approveSettlement(id: string, dto: ApproveSettlementDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.newSettlement.findUniqueOrThrow({
        where: { id },
        include: { case: true },
      });

      if (settlement.status !== SettlementStatus.PENDING) {
        throw new ConflictException('Settlement must be in PENDING status');
      }

      const updated = await tx.newSettlement.update({
        where: { id },
        data: {
          status: SettlementStatus.APPROVED,
          approvedBy: adminId,
          approvedAt: new Date(),
          notes: dto.notes,
        },
      });

      const event = await this.ledgerService.appendEvent(
        settlement.caseId,
        adminId,
        EventType.SETTLEMENT_APPROVED,
        {
          settlementId: id,
          type: settlement.type,
          amount: settlement.amount.toString(),
          statusFrom: 'PENDING',
          statusTo: 'APPROVED',
        },
        tx,
      );

      return { ...updated, event };
    });
  }

  // ── 정산 거부 (PENDING → REJECTED) ──

  async rejectSettlement(id: string, dto: RejectSettlementDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.newSettlement.findUniqueOrThrow({
        where: { id },
      });

      if (settlement.status !== SettlementStatus.PENDING) {
        throw new ConflictException('Settlement must be in PENDING status');
      }

      const updated = await tx.newSettlement.update({
        where: { id },
        data: {
          status: SettlementStatus.REJECTED,
          rejectedReason: dto.reason,
          approvedBy: adminId,
          approvedAt: new Date(),
        },
      });

      const event = await this.ledgerService.appendEvent(
        settlement.caseId,
        adminId,
        EventType.SETTLEMENT_REJECTED,
        {
          settlementId: id,
          type: settlement.type,
          amount: settlement.amount.toString(),
          reason: dto.reason,
        },
        tx,
      );

      return { ...updated, event };
    });
  }

  // ── 정산 지급 (APPROVED → PAID) ──

  async paySettlement(id: string, dto: PaySettlementDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.newSettlement.findUniqueOrThrow({
        where: { id },
        include: { case: true, lot: true },
      });

      if (settlement.status !== SettlementStatus.APPROVED) {
        throw new ConflictException('Settlement must be in APPROVED status');
      }

      const updated = await tx.newSettlement.update({
        where: { id },
        data: {
          status: SettlementStatus.PAID,
          paidAt: new Date(),
          notes: dto.notes
            ? `${settlement.notes ?? ''}\n[PAY] ${dto.notes}`.trim()
            : settlement.notes,
        },
      });

      // Lot SETTLED 전이: DELTA_2 PAID 시
      if (settlement.lotId && settlement.type === SettlementType.DELTA_2) {
        await tx.derivedLot.update({
          where: { id: settlement.lotId },
          data: { status: LotStatus.SETTLED },
        });
      }

      // Case SETTLED 전이: 모든 정산 PAID 시
      await this.checkCaseSettled(settlement.caseId, id, tx);

      const event = await this.ledgerService.appendEvent(
        settlement.caseId,
        adminId,
        EventType.SETTLEMENT_PAID,
        {
          settlementId: id,
          type: settlement.type,
          amount: settlement.amount.toString(),
          txReference: dto.txReference,
        },
        tx,
      );

      return { ...updated, event };
    });
  }

  // ── 일괄 승인 ──

  async batchApprove(dto: BatchApproveDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const settlements = await tx.newSettlement.findMany({
        where: { id: { in: dto.ids } },
      });

      const foundIds = new Set(settlements.map((s) => s.id));
      const missingIds = dto.ids.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Settlement(s) not found: ${missingIds.join(', ')}`,
        );
      }

      const nonPending = settlements.filter(
        (s) => s.status !== SettlementStatus.PENDING,
      );
      if (nonPending.length > 0) {
        throw new ConflictException(
          `${nonPending.length} settlement(s) are not in PENDING status`,
        );
      }

      const now = new Date();
      await tx.newSettlement.updateMany({
        where: { id: { in: dto.ids } },
        data: {
          status: SettlementStatus.APPROVED,
          approvedBy: adminId,
          approvedAt: now,
        },
      });

      for (const settlement of settlements) {
        await this.ledgerService.appendEvent(
          settlement.caseId,
          adminId,
          EventType.SETTLEMENT_APPROVED,
          {
            settlementId: settlement.id,
            settlementType: settlement.type,
            amount: settlement.amount.toString(),
            statusFrom: SettlementStatus.PENDING,
            statusTo: SettlementStatus.APPROVED,
            batchApprove: true,
          },
          tx,
        );
      }

      return {
        approved: dto.ids.length,
        approvedBy: adminId,
        approvedAt: now.toISOString(),
      };
    });
  }

  // ── SettlementRule CRUD ──

  async createSettlementRule(dto: CreateSettlementRuleDto) {
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.settlementRule.findFirst({
        where: { partType: dto.partType },
        orderBy: { version: 'desc' },
      });

      const newVersion = (latest?.version ?? 0) + 1;

      if (latest?.isActive) {
        await tx.settlementRule.updateMany({
          where: { partType: dto.partType, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.settlementRule.create({
        data: {
          partType: dto.partType,
          m0BaseAmount: dto.m0BaseAmount,
          deltaRatio: dto.deltaRatio,
          gradeBonusMap: dto.gradeBonusMap ?? { A: 20.0, B: 10.0, C: 5.0, D: 0.0 },
          platformFeeRate: dto.platformFeeRate ?? 0.05,
          currency: dto.currency ?? 'KRW',
          version: newVersion,
          isActive: true,
          description: dto.description,
        },
      });
    });
  }

  async findAllSettlementRules(partType?: PartType, activeOnly = true) {
    const where: Prisma.SettlementRuleWhereInput = {};
    if (partType) where.partType = partType;
    if (activeOnly) where.isActive = true;

    return this.prisma.settlementRule.findMany({
      where,
      orderBy: [{ partType: 'asc' }, { version: 'desc' }],
    });
  }

  // ── Case SETTLED 전이 체크 ──

  private async checkCaseSettled(
    caseId: string,
    justPaidId: string,
    tx: PrismaTransactionClient,
  ) {
    // 방금 PAID로 변경한 건 제외하고 미완료 정산 조회
    const unpaidCount = await tx.newSettlement.count({
      where: {
        caseId,
        status: { notIn: [SettlementStatus.PAID, SettlementStatus.REJECTED] },
        id: { not: justPaidId },
      },
    });

    if (unpaidCount === 0) {
      // 최소 하나 이상 PAID 확인
      const paidCount = await tx.newSettlement.count({
        where: { caseId, status: SettlementStatus.PAID },
      });
      if (paidCount > 0) {
        await tx.vehicleCase.update({
          where: { id: caseId },
          data: { status: CaseStatus.SETTLED },
        });
      }
    }
  }
}
