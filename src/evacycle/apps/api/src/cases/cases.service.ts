import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CaseStatus, EventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateCaseDto } from './dto/create-case.dto';

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createCase(dto: CreateCaseDto, actorId: string, orgId: string) {
    return this.prisma.$transaction(async (tx) => {
      // caseNo 생성: EVA-YYYYMM-NNNNN
      const now = new Date();
      const prefix = `EVA-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const count = await tx.vehicleCase.count({
        where: { caseNo: { startsWith: prefix } },
      });
      const caseNo = `${prefix}-${String(count + 1).padStart(5, '0')}`;

      const vehicleCase = await tx.vehicleCase.create({
        data: {
          orgId,
          createdBy: actorId,
          caseNo,
          vehicleMaker: dto.vehicleMaker,
          vehicleModel: dto.vehicleModel,
          vehicleYear: dto.vehicleYear,
          vin: dto.vin,
          notes: dto.notes,
          status: CaseStatus.DRAFT,
        },
      });

      // CASE_CREATED 이벤트를 원장에 기록
      // 트랜잭션 내에서 직접 ledger insert (LedgerService는 자체 tx를 쓰므로 여기서는 직접)
      const createdAt = new Date();
      const { computeSelfHash } = await import('../ledger/hash.util');
      const payload = {
        caseNo: vehicleCase.caseNo,
        vehicleMaker: vehicleCase.vehicleMaker,
        vehicleModel: vehicleCase.vehicleModel,
        vehicleYear: vehicleCase.vehicleYear,
      };
      const selfHash = computeSelfHash({
        caseId: vehicleCase.id,
        seq: 1,
        eventType: EventType.CASE_CREATED,
        actorId,
        prevHash: '0'.repeat(64),
        payload,
        createdAt,
      });

      await tx.eventLedger.create({
        data: {
          caseId: vehicleCase.id,
          actorId,
          seq: 1,
          eventType: EventType.CASE_CREATED,
          payload,
          prevHash: '0'.repeat(64),
          selfHash,
          createdAt,
        },
      });

      return vehicleCase;
    });
  }

  async submitCase(caseId: string, actorId: string) {
    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });

    if (!vehicleCase) {
      throw new NotFoundException('Case not found');
    }

    if (vehicleCase.status !== CaseStatus.DRAFT) {
      throw new ConflictException('Case can only be submitted from DRAFT status');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicleCase.update({
        where: { id: caseId },
        data: { status: CaseStatus.SUBMITTED },
      });

      // 트랜잭션 내에서 직접 이벤트 기록
      const lastEvent = await tx.eventLedger.findFirst({
        where: { caseId },
        orderBy: { seq: 'desc' },
      });

      const seq = (lastEvent?.seq ?? 0) + 1;
      const prevHash = lastEvent?.selfHash ?? '0'.repeat(64);
      const createdAt = new Date();
      const payload = { previousStatus: CaseStatus.DRAFT, newStatus: CaseStatus.SUBMITTED };

      const { computeSelfHash } = await import('../ledger/hash.util');
      const selfHash = computeSelfHash({
        caseId,
        seq,
        eventType: EventType.CASE_SUBMITTED,
        actorId,
        prevHash,
        payload,
        createdAt,
      });

      await tx.eventLedger.create({
        data: {
          caseId,
          actorId,
          seq,
          eventType: EventType.CASE_SUBMITTED,
          payload,
          prevHash,
          selfHash,
          createdAt,
        },
      });

      return updated;
    });
  }

  async findAll(skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.vehicleCase.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicleCase.count(),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id },
      include: { ledger: { orderBy: { seq: 'asc' } } },
    });
    if (!vehicleCase) {
      throw new NotFoundException('Case not found');
    }
    return vehicleCase;
  }
}
