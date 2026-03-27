import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  SettlementStatus,
  SettlementType,
  EventType,
  CaseStatus,
  LotStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SettlementsService } from './settlements.service';

const ADMIN_ID = 'admin-uuid-1';

function makeSettlement(overrides: Partial<any> = {}) {
  return {
    id: 'settlement-uuid-1',
    caseId: 'case-uuid-1',
    lotId: null,
    yardUserId: 'yard-uuid-1',
    type: SettlementType.M0,
    status: SettlementStatus.PENDING,
    grossAmount: new Decimal(800000),
    feeRate: new Decimal(0.05),
    feeAmount: new Decimal(40000),
    amount: new Decimal(760000),
    currency: 'KRW',
    ruleSnapshot: null,
    calcDetail: null,
    triggeredByEvent: null,
    notes: null,
    approvedBy: null,
    approvedAt: null,
    paidAt: null,
    rejectedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockLedger() {
  return {
    appendEvent: jest.fn().mockResolvedValue({
      id: 'event-1',
      seq: 3,
      eventType: EventType.SETTLEMENT_APPROVED,
      selfHash: 'abc123',
    }),
  };
}

function createMockPrisma(settlement: any, allSettlements?: any[]) {
  const txClient = {
    newSettlement: {
      findUniqueOrThrow: jest.fn().mockImplementation(() => {
        if (!settlement) throw new NotFoundException('Settlement not found');
        return Promise.resolve(settlement);
      }),
      findMany: jest.fn().mockResolvedValue(allSettlements ?? [settlement]),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...settlement, ...data }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: allSettlements?.length ?? 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    vehicleCase: {
      update: jest.fn().mockResolvedValue({ id: 'case-uuid-1', status: CaseStatus.SETTLED }),
    },
    derivedLot: {
      update: jest.fn().mockResolvedValue({ id: 'lot-1', status: LotStatus.SETTLED }),
    },
  };
  return {
    $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
    newSettlement: txClient.newSettlement,
    vehicleCase: txClient.vehicleCase,
  } as any;
}

describe('SettlementsService — approveSettlement', () => {
  let service: SettlementsService;
  let mockLedger: ReturnType<typeof createMockLedger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLedger = createMockLedger();
  });

  it('should approve a PENDING settlement', async () => {
    const settlement = makeSettlement();
    const prisma = createMockPrisma(settlement);
    service = new SettlementsService(prisma, mockLedger as any);

    const result = await service.approveSettlement(
      settlement.id,
      { notes: '확인 완료' },
      ADMIN_ID,
    );

    expect(result.status).toBe(SettlementStatus.APPROVED);
    expect(result.approvedBy).toBe(ADMIN_ID);
  });

  it('should record SETTLEMENT_APPROVED event', async () => {
    const settlement = makeSettlement();
    const prisma = createMockPrisma(settlement);
    service = new SettlementsService(prisma, mockLedger as any);

    await service.approveSettlement(settlement.id, {}, ADMIN_ID);

    expect(mockLedger.appendEvent).toHaveBeenCalledWith(
      settlement.caseId,
      ADMIN_ID,
      EventType.SETTLEMENT_APPROVED,
      expect.objectContaining({
        settlementId: settlement.id,
        statusFrom: 'PENDING',
        statusTo: 'APPROVED',
      }),
      expect.anything(),
    );
  });

  it('should deny approve if not PENDING', async () => {
    const settlement = makeSettlement({ status: SettlementStatus.APPROVED });
    const prisma = createMockPrisma(settlement);
    service = new SettlementsService(prisma, mockLedger as any);

    await expect(
      service.approveSettlement(settlement.id, {}, ADMIN_ID),
    ).rejects.toThrow(ConflictException);
  });
});

describe('SettlementsService — rejectSettlement', () => {
  let service: SettlementsService;
  let mockLedger: ReturnType<typeof createMockLedger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLedger = createMockLedger();
  });

  it('should reject a PENDING settlement with reason', async () => {
    const settlement = makeSettlement();
    const prisma = createMockPrisma(settlement);
    service = new SettlementsService(prisma, mockLedger as any);

    const result = await service.rejectSettlement(
      settlement.id,
      { reason: '금액 산정 오류 — 재계산 필요' },
      ADMIN_ID,
    );

    expect(result.status).toBe(SettlementStatus.REJECTED);
    expect(result.rejectedReason).toBe('금액 산정 오류 — 재계산 필요');
  });

  it('should deny reject if not PENDING', async () => {
    const settlement = makeSettlement({ status: SettlementStatus.APPROVED });
    const prisma = createMockPrisma(settlement);
    service = new SettlementsService(prisma, mockLedger as any);

    await expect(
      service.rejectSettlement(settlement.id, { reason: 'test reason' }, ADMIN_ID),
    ).rejects.toThrow(ConflictException);
  });
});

describe('SettlementsService — paySettlement', () => {
  let service: SettlementsService;
  let mockLedger: ReturnType<typeof createMockLedger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLedger = createMockLedger();
  });

  it('should pay an APPROVED settlement', async () => {
    const settlement = makeSettlement({
      status: SettlementStatus.APPROVED,
      case: { id: 'case-uuid-1' },
      lot: null,
    });
    const prisma = createMockPrisma(settlement);
    service = new SettlementsService(prisma, mockLedger as any);

    const result = await service.paySettlement(
      settlement.id,
      { notes: '송금 완료' },
      ADMIN_ID,
    );

    expect(result.status).toBe(SettlementStatus.PAID);
  });

  it('should deny pay if not APPROVED', async () => {
    const settlement = makeSettlement({
      status: SettlementStatus.PENDING,
      case: { id: 'case-uuid-1' },
      lot: null,
    });
    const prisma = createMockPrisma(settlement);
    service = new SettlementsService(prisma, mockLedger as any);

    await expect(
      service.paySettlement(settlement.id, {}, ADMIN_ID),
    ).rejects.toThrow(ConflictException);
  });
});

describe('SettlementsService — batchApprove', () => {
  let service: SettlementsService;
  let mockLedger: ReturnType<typeof createMockLedger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLedger = createMockLedger();
  });

  it('should approve all PENDING settlements', async () => {
    const settlements = [
      makeSettlement({ id: 'a' }),
      makeSettlement({ id: 'b' }),
    ];
    const prisma = createMockPrisma(null, settlements);
    service = new SettlementsService(prisma, mockLedger as any);

    const result = await service.batchApprove(
      { ids: ['a', 'b'] },
      ADMIN_ID,
    );

    expect(result.approved).toBe(2);
    expect(result.approvedBy).toBe(ADMIN_ID);
  });

  it('should throw NotFoundException when some IDs are missing', async () => {
    const settlements = [makeSettlement({ id: 'a' })];
    const prisma = createMockPrisma(null, settlements);
    service = new SettlementsService(prisma, mockLedger as any);

    await expect(
      service.batchApprove({ ids: ['a', 'missing'] }, ADMIN_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when non-PENDING included', async () => {
    const settlements = [
      makeSettlement({ id: 'a' }),
      makeSettlement({ id: 'b', status: SettlementStatus.APPROVED }),
    ];
    const prisma = createMockPrisma(null, settlements);
    service = new SettlementsService(prisma, mockLedger as any);

    await expect(
      service.batchApprove({ ids: ['a', 'b'] }, ADMIN_ID),
    ).rejects.toThrow(ConflictException);
  });
});
