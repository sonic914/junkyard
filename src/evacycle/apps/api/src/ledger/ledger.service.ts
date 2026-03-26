import { Injectable } from '@nestjs/common';
import { EventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeSelfHash } from './hash.util';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async appendEvent(
    caseId: string,
    actorId: string,
    eventType: EventType,
    payload: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lastEvent = await tx.eventLedger.findFirst({
        where: { caseId },
        orderBy: { seq: 'desc' },
      });

      const seq = (lastEvent?.seq ?? 0) + 1;
      const prevHash = lastEvent?.selfHash ?? '0'.repeat(64);
      const createdAt = new Date();

      const selfHash = computeSelfHash({
        caseId,
        seq,
        eventType,
        actorId,
        prevHash,
        payload,
        createdAt,
      });

      return tx.eventLedger.create({
        data: {
          caseId,
          actorId,
          seq,
          eventType,
          payload: payload as Prisma.InputJsonValue,
          prevHash,
          selfHash,
          createdAt,
        },
      });
    });
  }

  async findAllByCaseId(caseId: string) {
    return this.prisma.eventLedger.findMany({
      where: { caseId },
      orderBy: { seq: 'asc' },
    });
  }

  async verifyChain(caseId: string): Promise<{ isValid: boolean; brokenAt: number | null }> {
    const events = await this.prisma.eventLedger.findMany({
      where: { caseId },
      orderBy: { seq: 'asc' },
    });

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const expectedHash = computeSelfHash({
        caseId: event.caseId,
        seq: event.seq,
        eventType: event.eventType,
        actorId: event.actorId,
        prevHash: event.prevHash,
        payload: event.payload as Record<string, unknown>,
        createdAt: event.createdAt,
      });

      if (expectedHash !== event.selfHash) {
        return { isValid: false, brokenAt: event.seq };
      }

      // 배열 인덱스로 이전 이벤트 참조 (seq gap 있어도 안전)
      const prevEvent = i > 0 ? events[i - 1] : null;
      const expectedPrevHash = prevEvent?.selfHash ?? '0'.repeat(64);
      if (event.prevHash !== expectedPrevHash) {
        return { isValid: false, brokenAt: event.seq };
      }
    }

    return { isValid: true, brokenAt: null };
  }
}
