import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CaseStatus, EventType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { CASE_TRANSITIONS } from './case-state-machine';
import { EVENT_LABELS } from '../common/constants/event-labels';
import { computeSelfHash } from '../ledger/hash.util';

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createCase(dto: CreateCaseDto, actorId: string, orgId: string) {
    return this.prisma.$transaction(async (tx) => {
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

      const createdAt = new Date();
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

  async transitionCase(
    caseId: string,
    eventType: EventType,
    actorId: string,
    actorRole: UserRole,
    payload?: Record<string, any>,
  ) {
    const rule = CASE_TRANSITIONS[eventType];
    if (!rule) {
      throw new BadRequestException(`Unknown event type: ${eventType}`);
    }

    if (!rule.allowedRoles.includes(actorRole)) {
      throw new ForbiddenException(`Role ${actorRole} cannot perform ${eventType}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const vehicleCase = await tx.vehicleCase.findUnique({
        where: { id: caseId },
      });

      if (!vehicleCase) {
        throw new NotFoundException('Case not found');
      }

      if (!rule.fromStatus.includes(vehicleCase.status as CaseStatus)) {
        throw new ConflictException(
          `Cannot ${eventType} from status ${vehicleCase.status}`,
        );
      }

      const updated = await tx.vehicleCase.update({
        where: { id: caseId },
        data: { status: rule.toStatus },
      });

      const event = await this.ledgerService.appendEvent(
        caseId,
        actorId,
        eventType,
        {
          ...payload,
          statusFrom: vehicleCase.status,
          statusTo: rule.toStatus,
        },
        tx,
      );

      return { ...updated, event };
    });
  }

  async submitCase(caseId: string, actorId: string, actorRole: UserRole) {
    return this.transitionCase(caseId, EventType.CASE_SUBMITTED, actorId, actorRole);
  }

  async cancelCase(caseId: string, actorId: string, actorRole: UserRole, reason: string) {
    return this.transitionCase(caseId, EventType.CASE_CANCELLED, actorId, actorRole, { reason });
  }

  async getTimeline(caseId: string) {
    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });

    if (!vehicleCase) {
      throw new NotFoundException('Case not found');
    }

    const events = await this.ledgerService.findAllByCaseId(caseId);
    const { isValid } = await this.ledgerService.verifyChain(caseId);

    const timeline = await Promise.all(
      events.map(async (event) => {
        const actor = await this.prisma.user.findUnique({
          where: { id: event.actorId },
          select: {
            id: true,
            name: true,
            role: true,
            org: { select: { name: true } },
          },
        });

        const files = await this.prisma.caseFile.findMany({
          where: { caseId, eventId: event.id, status: { not: 'DELETED' } },
          select: {
            id: true,
            fileName: true,
            fileType: true,
            objectKey: true,
            uploadedAt: true,
          },
        });

        return {
          seq: event.seq,
          eventType: event.eventType,
          label: EVENT_LABELS[event.eventType] ?? event.eventType,
          actor: actor
            ? {
                id: actor.id,
                name: actor.name,
                role: actor.role,
                orgName: actor.org?.name,
              }
            : null,
          payload: event.payload,
          files,
          createdAt: event.createdAt,
        };
      }),
    );

    return {
      caseId,
      caseNo: vehicleCase.caseNo,
      currentStatus: vehicleCase.status,
      timeline,
      hashChainValid: isValid,
    };
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
