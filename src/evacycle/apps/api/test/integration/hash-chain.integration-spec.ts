import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { computeSelfHash } from '../../src/ledger/hash.util';
import { EventType } from '@prisma/client';

describe('EventLedger 해시 체인 무결성', () => {
  let prisma: PrismaService;
  let ledgerService: LedgerService;

  let orgId: string;
  let userId: string;
  let caseId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, LedgerService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    ledgerService = module.get<LedgerService>(LedgerService);

    // Seed
    const org = await prisma.organization.create({
      data: { name: 'HashTestOrg', type: 'JUNKYARD', bizNo: '666-66-66666' },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        email: 'hash-test@test.com',
        name: 'Hash Tester',
        role: 'JUNKYARD',
      },
    });
    userId = user.id;

    const vc = await prisma.vehicleCase.create({
      data: {
        orgId: org.id,
        createdBy: user.id,
        caseNo: 'EVA-202603-88888',
        vehicleMaker: '현대',
        vehicleModel: '해시테스트',
        vehicleYear: 2020,
        vin: 'HASHTEST000000001',
        status: 'DRAFT',
      },
    });
    caseId = vc.id;

    // 이벤트 여러 개 추가
    await ledgerService.appendEvent(caseId, userId, EventType.CASE_CREATED, {
      caseNo: vc.caseNo,
    });
    await ledgerService.appendEvent(caseId, userId, EventType.CASE_SUBMITTED, {
      statusFrom: 'DRAFT',
      statusTo: 'SUBMITTED',
    });
    await ledgerService.appendEvent(caseId, userId, EventType.COC_SIGNED, {
      signedBy: 'Hash Tester',
      signedAt: '2026-03-27T10:00:00.000Z',
      statusFrom: 'SUBMITTED',
      statusTo: 'IN_TRANSIT',
    });
  });

  afterAll(async () => {
    await prisma.eventLedger.deleteMany({ where: { caseId } });
    await prisma.vehicleCase.delete({ where: { id: caseId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.organization.delete({ where: { id: orgId } });
  });

  it('전체 이벤트에 대해 해시 체인 유효', async () => {
    const result = await ledgerService.verifyChain(caseId);
    expect(result.isValid).toBe(true);
    expect(result.brokenAt).toBeNull();
  });

  it('첫 이벤트의 prevHash는 0×64', async () => {
    const firstEvent = await prisma.eventLedger.findFirst({
      where: { caseId },
      orderBy: { seq: 'asc' },
    });
    expect(firstEvent!.prevHash).toBe('0'.repeat(64));
  });

  it('각 이벤트의 prevHash === 이전 이벤트의 selfHash', async () => {
    const events = await prisma.eventLedger.findMany({
      where: { caseId },
      orderBy: { seq: 'asc' },
    });

    for (let i = 1; i < events.length; i++) {
      expect(events[i].prevHash).toBe(events[i - 1].selfHash);
    }
  });

  it('selfHash 재계산 결과 일치', async () => {
    const events = await prisma.eventLedger.findMany({
      where: { caseId },
      orderBy: { seq: 'asc' },
    });

    for (const event of events) {
      const recomputed = computeSelfHash({
        caseId: event.caseId,
        seq: event.seq,
        eventType: event.eventType,
        actorId: event.actorId,
        prevHash: event.prevHash,
        payload: event.payload as Record<string, unknown>,
        createdAt: event.createdAt,
      });
      expect(recomputed).toBe(event.selfHash);
    }
  });

  it('payload 변조 감지', async () => {
    const event = await prisma.eventLedger.findFirst({
      where: { caseId, seq: 2 },
    });

    // DB 직접 수정으로 변조 시뮬레이션
    await prisma.$executeRaw`
      UPDATE "EventLedger"
      SET payload = '{"tampered": true}'::jsonb
      WHERE id = ${event!.id}
    `;

    const result = await ledgerService.verifyChain(caseId);
    expect(result.isValid).toBe(false);
    expect(result.brokenAt).toBe(2);

    // 원복
    await prisma.$executeRaw`
      UPDATE "EventLedger"
      SET payload = ${JSON.stringify(event!.payload)}::jsonb
      WHERE id = ${event!.id}
    `;

    // 원복 확인
    const restored = await ledgerService.verifyChain(caseId);
    expect(restored.isValid).toBe(true);
  });

  it('prevHash 변조 감지', async () => {
    const event = await prisma.eventLedger.findFirst({
      where: { caseId, seq: 3 },
    });

    const fakePrevHash = 'a'.repeat(64);
    await prisma.$executeRaw`
      UPDATE "EventLedger"
      SET "prevHash" = ${fakePrevHash}
      WHERE id = ${event!.id}
    `;

    const result = await ledgerService.verifyChain(caseId);
    expect(result.isValid).toBe(false);
    expect(result.brokenAt).toBe(3);

    // 원복
    await prisma.$executeRaw`
      UPDATE "EventLedger"
      SET "prevHash" = ${event!.prevHash}
      WHERE id = ${event!.id}
    `;
  });

  it('seq 순서 검증 (비연속 seq에도 안전)', async () => {
    const events = await prisma.eventLedger.findMany({
      where: { caseId },
      orderBy: { seq: 'asc' },
    });

    // seq는 1부터 순차적으로 증가해야 함
    for (let i = 0; i < events.length; i++) {
      expect(events[i].seq).toBe(i + 1);
    }
  });
});
