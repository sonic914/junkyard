import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { SettlementHookService } from '../../src/settlements/settlement-hook.service';
import { SettlementType, PartType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('M0+Δ 정산 금액 계산 정확도', () => {
  let prisma: PrismaService;
  let settlementHookService: SettlementHookService;
  let ledgerService: LedgerService;

  let orgId: string;
  let userId: string;
  let caseId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, LedgerService, SettlementHookService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    ledgerService = module.get<LedgerService>(LedgerService);
    settlementHookService = module.get<SettlementHookService>(SettlementHookService);

    // Seed test data
    const org = await prisma.organization.create({
      data: { name: 'SettlementTestOrg', type: 'JUNKYARD', bizNo: '777-77-77777' },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        email: 'settlement-test@test.com',
        name: 'Settlement Tester',
        role: 'JUNKYARD',
      },
    });
    userId = user.id;

    // Create SettlementRules
    await prisma.settlementRule.createMany({
      data: [
        {
          partType: 'BATTERY',
          m0BaseAmount: 500000,
          deltaRatio: 15.0,
          version: 1,
          isActive: true,
        },
        {
          partType: 'MOTOR',
          m0BaseAmount: 300000,
          deltaRatio: 12.0,
          version: 1,
          isActive: true,
        },
      ],
    });

    // Create a Case (직접 DB에 생성)
    const vc = await prisma.vehicleCase.create({
      data: {
        orgId: org.id,
        createdBy: user.id,
        caseNo: 'EVA-202603-99999',
        vehicleMaker: '현대',
        vehicleModel: '테스트',
        vehicleYear: 2020,
        vin: 'SETTLTEST00000001',
        status: 'SUBMITTED',
      },
    });
    caseId = vc.id;

    // 첫 이벤트(CASE_CREATED) 생성 — 해시 체인 시작
    await ledgerService.appendEvent(caseId, userId, 'CASE_CREATED', {
      caseNo: vc.caseNo,
    });
  });

  afterAll(async () => {
    await prisma.newSettlement.deleteMany({ where: { caseId } });
    await prisma.eventLedger.deleteMany({ where: { caseId } });
    await prisma.vehicleCase.delete({ where: { id: caseId } });
    await prisma.settlementRule.deleteMany({});
    await prisma.user.delete({ where: { id: userId } });
    await prisma.organization.delete({ where: { id: orgId } });
  });

  it('M0: partType별 m0BaseAmount 합산 정확도', async () => {
    await prisma.$transaction(async (tx) => {
      await settlementHookService.onCaseSubmitted(
        caseId,
        userId,
        [PartType.BATTERY, PartType.MOTOR],
        tx,
      );
    });

    const m0 = await prisma.newSettlement.findFirst({
      where: { caseId, type: 'M0' },
    });

    // BATTERY(500,000) + MOTOR(300,000) = 800,000
    expect(m0).toBeDefined();
    expect(m0!.amount.toNumber()).toBe(800000);
    expect(m0!.status).toBe('PENDING');
    expect(m0!.currency).toBe('KRW');
  });

  it('M0: ruleSnapshot 기록 검증', async () => {
    const m0 = await prisma.newSettlement.findFirst({
      where: { caseId, type: 'M0' },
    });

    expect(m0!.ruleSnapshot).toBeDefined();
    const snapshot = m0!.ruleSnapshot as any[];
    expect(snapshot).toHaveLength(2);
    expect(snapshot.map((s: any) => s.partType).sort()).toEqual([
      'BATTERY',
      'MOTOR',
    ]);
  });

  it('DELTA: salePrice × deltaRatio / 100', async () => {
    // DerivedLot 생성
    const lot = await prisma.derivedLot.create({
      data: {
        caseId,
        lotNo: 'LOT-202603-99999',
        partType: 'BATTERY',
        routingDecision: 'REUSE',
        reuseGrade: 'A',
        recycleGrade: 'R1',
        quantity: 1,
        weightKg: 300,
        status: 'SOLD',
      },
    });

    const salePrice = new Decimal(1500000);

    await prisma.$transaction(async (tx) => {
      await settlementHookService.onLotSold(
        lot.id,
        caseId,
        userId,
        PartType.BATTERY,
        salePrice,
        tx,
      );
    });

    const delta = await prisma.newSettlement.findFirst({
      where: { caseId, type: 'DELTA', lotId: lot.id },
    });

    // 1,500,000 × 15% = 225,000
    expect(delta).toBeDefined();
    expect(delta!.amount.toNumber()).toBe(225000);

    // cleanup
    await prisma.newSettlement.deleteMany({ where: { lotId: lot.id } });
    await prisma.derivedLot.delete({ where: { id: lot.id } });
  });

  it('DELTA: MOTOR partType — 다른 deltaRatio 적용', async () => {
    const lot = await prisma.derivedLot.create({
      data: {
        caseId,
        lotNo: 'LOT-202603-99998',
        partType: 'MOTOR',
        routingDecision: 'RECYCLE',
        reuseGrade: 'C',
        recycleGrade: 'R1',
        quantity: 1,
        weightKg: 50,
        status: 'SOLD',
      },
    });

    const salePrice = new Decimal(800000);

    await prisma.$transaction(async (tx) => {
      await settlementHookService.onLotSold(
        lot.id,
        caseId,
        userId,
        PartType.MOTOR,
        salePrice,
        tx,
      );
    });

    const delta = await prisma.newSettlement.findFirst({
      where: { caseId, type: 'DELTA', lotId: lot.id },
    });

    // 800,000 × 12% = 96,000
    expect(delta).toBeDefined();
    expect(delta!.amount.toNumber()).toBe(96000);

    // DELTA ruleSnapshot 검증
    const snapshot = delta!.ruleSnapshot as any;
    expect(snapshot.partType).toBe('MOTOR');
    expect(snapshot.deltaRatio).toBe('12');
    expect(snapshot.version).toBe(1);

    // cleanup
    await prisma.newSettlement.deleteMany({ where: { lotId: lot.id } });
    await prisma.derivedLot.delete({ where: { id: lot.id } });
  });
});
