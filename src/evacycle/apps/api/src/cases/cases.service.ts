import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CaseStatus, EventType, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FilesService } from '../files/files.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { CASE_TRANSITIONS } from './case-state-machine';
import { EVENT_LABELS } from '../common/constants/event-labels';
import { computeSelfHash } from '../ledger/hash.util';
import { paginate } from '../common/dto/paginated-response.dto';

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly filesService: FilesService,
    private readonly configService: ConfigService,
  ) {}

  async createCase(dto: CreateCaseDto, actorId: string, orgId: string) {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
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
      } catch (error: any) {
        // P2002: Unique constraint violation on caseNo — retry
        if (error?.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }
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

    if (rule.requiredPayloadFields?.length) {
      const missing = rule.requiredPayloadFields.filter(
        (field) => !payload || payload[field] == null,
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Missing required payload fields for ${eventType}: ${missing.join(', ')}`,
        );
      }
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

      // COD-57: COC_SIGNED 시 허브 자동 배정
      let hubOrgId: string | undefined;
      if (eventType === EventType.COC_SIGNED) {
        if (payload?.toOrgId) {
          const hub = await tx.organization.findFirst({
            where: { id: payload.toOrgId, type: 'HUB', isActive: true },
          });
          if (!hub) {
            throw new BadRequestException('유효하지 않은 허브 조직입니다.');
          }
          hubOrgId = hub.id;
        } else {
          const defaultHubId = this.configService.get<string>('DEFAULT_HUB_ORG_ID');
          if (defaultHubId) {
            const hub = await tx.organization.findFirst({
              where: { id: defaultHubId, type: 'HUB', isActive: true },
            });
            if (hub) hubOrgId = hub.id;
          }
        }
      }

      let updated = vehicleCase;
      // toStatus가 null이면 상태 변경 없음 (이벤트 기록만)
      if (rule.toStatus !== null) {
        try {
          updated = await tx.vehicleCase.update({
            where: { id: caseId, status: vehicleCase.status },
            data: {
              status: rule.toStatus,
              ...(hubOrgId ? { hubOrgId } : {}),
            },
          });
        } catch (error: any) {
          if (error?.code === 'P2025') {
            throw new ConflictException('상태가 이미 변경되었습니다');
          }
          throw error;
        }
      }

      const event = await this.ledgerService.appendEvent(
        caseId,
        actorId,
        eventType,
        {
          ...payload,
          statusFrom: vehicleCase.status,
          statusTo: rule.toStatus ?? vehicleCase.status,
          ...(hubOrgId ? { assignedHubOrgId: hubOrgId } : {}),
        },
        tx,
      );

      return { ...updated, event };
    });
  }

  async submitCase(caseId: string, actorId: string, actorRole: UserRole) {
    const rule = CASE_TRANSITIONS[EventType.CASE_SUBMITTED];
    if (!rule.allowedRoles.includes(actorRole)) {
      throw new ForbiddenException(`Role ${actorRole} cannot perform CASE_SUBMITTED`);
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
          `Cannot CASE_SUBMITTED from status ${vehicleCase.status}`,
        );
      }

      let updated;
      try {
        updated = await tx.vehicleCase.update({
          where: { id: caseId, status: vehicleCase.status },
          data: { status: rule.toStatus! },
        });
      } catch (error: any) {
        if (error?.code === 'P2025') {
          throw new ConflictException('상태가 이미 변경되었습니다');
        }
        throw error;
      }

      const event = await this.ledgerService.appendEvent(
        caseId,
        actorId,
        EventType.CASE_SUBMITTED,
        {
          statusFrom: vehicleCase.status,
          statusTo: rule.toStatus,
        },
        tx,
      );

      // CP4: M0는 PURCHASE_COMPLETED 시점에 생성 (Conservative 방식)

      return { ...updated, event };
    });
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
            status: true,
            uploadedAt: true,
          },
        });

        const filesWithUrls = await Promise.all(
          files.map(async (f) => {
            let downloadUrl: string | null = null;
            if (f.status === 'CONFIRMED') {
              downloadUrl = await this.filesService.getPresignedDownloadUrl(f.objectKey);
            }
            return {
              id: f.id,
              fileName: f.fileName,
              fileType: f.fileType,
              objectKey: f.objectKey,
              downloadUrl,
              uploadedAt: f.uploadedAt,
            };
          }),
        );

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
          files: filesWithUrls,
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

  async findAll(skip: number, take: number, orgId?: string) {
    const where = orgId ? {
      OR: [
        { orgId },
        { hubOrgId: orgId },
        { intakeOrgId: orgId },
      ]
    } : {};
    const [data, total] = await Promise.all([
      this.prisma.vehicleCase.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicleCase.count({ where }),
    ]);
    return paginate(data, total, { skip, take });
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

  // ── COD-34: 허브 조직 할당 ────────────────────────────────────────────────
  async assignHub(caseId: string, hubOrgId: string, actorId: string) {
    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    if (!vehicleCase) throw new NotFoundException('Case not found');

    const updated = await this.prisma.vehicleCase.update({
      where: { id: caseId },
      data: { hubOrgId },
      include: {
        ownerOrg: { select: { id: true, name: true } },
        hubOrg:   { select: { id: true, name: true } },
        creator:  { select: { id: true, name: true } },
      },
    });

    return updated;
  }
}
