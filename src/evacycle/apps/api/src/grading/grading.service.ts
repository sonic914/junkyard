import {
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { CaseStatus, EventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateGradingDto } from './dto/create-grading.dto';

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createGrading(caseId: string, dto: CreateGradingDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Case 상태 검증: RECEIVED 또는 GRADING
      const vehicleCase = await tx.vehicleCase.findUniqueOrThrow({
        where: { id: caseId },
      });
      if (
        vehicleCase.status !== CaseStatus.RECEIVED &&
        vehicleCase.status !== CaseStatus.GRADING
      ) {
        throw new ConflictException(
          'Case must be in RECEIVED or GRADING status for grading',
        );
      }

      // 2. 해당 partType 중복 그레이딩 체크
      const existing = await tx.grading.findFirst({
        where: { caseId, partType: dto.partType },
      });
      if (existing) {
        throw new ConflictException(
          `Grading for ${dto.partType} already exists`,
        );
      }

      // 3. 활성 GradingRule 스냅샷 가져오기
      const rule = await tx.gradingRule.findFirst({
        where: { partType: dto.partType, isActive: true },
        orderBy: { version: 'desc' },
      });

      // 4. Grading 레코드 생성
      const grading = await tx.grading.create({
        data: {
          caseId,
          actorId,
          partType: dto.partType,
          reuseGrade: dto.reuseGrade,
          recycleGrade: dto.recycleGrade,
          routingDecision: dto.routingDecision,
          notes: dto.notes,
          ruleSnapshot: rule ? JSON.parse(JSON.stringify(rule)) : null,
        },
        include: {
          actor: { select: { id: true, name: true, role: true } },
        },
      });

      // 5. Case 상태 → GRADING (첫 그레이딩 시)
      if (vehicleCase.status === CaseStatus.RECEIVED) {
        await tx.vehicleCase.update({
          where: { id: caseId },
          data: { status: CaseStatus.GRADING },
        });
      }

      // 6. 이벤트 원장 기록
      const event = await this.ledgerService.appendEvent(
        caseId,
        actorId,
        EventType.GRADING_SUBMITTED,
        {
          partType: dto.partType,
          reuseGrade: dto.reuseGrade,
          recycleGrade: dto.recycleGrade,
          routingDecision: dto.routingDecision,
          statusFrom: vehicleCase.status,
          statusTo: CaseStatus.GRADING,
        },
        tx,
      );

      return { ...grading, event };
    });
  }

  async findByCaseId(caseId: string) {
    const vehicleCase = await this.prisma.vehicleCase.findUniqueOrThrow({
      where: { id: caseId },
      select: { id: true, caseNo: true },
    });

    const gradings = await this.prisma.grading.findMany({
      where: { caseId },
      include: {
        actor: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      caseId: vehicleCase.id,
      caseNo: vehicleCase.caseNo,
      gradings,
    };
  }
}
