import { SettlementType, SettlementStatus, EventType, PartType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SettlementHookService } from './settlement-hook.service';

const CASE_ID = 'case-uuid-1';
const LOT_ID = 'lot-uuid-1';
const YARD_USER_ID = 'yard-user-1';
const ORG_ID = 'org-uuid-1';

function createMockLedgerService() {
  return {
    appendEvent: jest.fn().mockResolvedValue({
      id: 'event-1',
      seq: 2,
      eventType: EventType.SETTLEMENT_CREATED,
      selfHash: 'abc123',
    }),
  };
}

function makeRule(partType: PartType, m0Base = 500000) {
  return {
    id: 'rule-uuid-1',
    partType,
    m0BaseAmount: new Decimal(m0Base),
    deltaRatio: new Decimal(15),
    gradeBonusMap: { A: 20.0, B: 10.0, C: 5.0, D: 0.0 },
    platformFeeRate: new Decimal(0.05),
    version: 1,
    isActive: true,
    currency: 'KRW',
  };
}

function createMockTx(
  rules: any[],
  options?: {
    existingM0?: any;
    allLots?: any[];
    delta1?: any;
  },
) {
  return {
    settlementRule: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = rules.find((r: any) => r.partType === where.partType);
        return Promise.resolve(found ?? null);
      }),
    },
    vehicleCase: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: CASE_ID,
        orgId: ORG_ID,
      }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: YARD_USER_ID,
        orgId: ORG_ID,
        isActive: true,
      }),
    },
    derivedLot: {
      findMany: jest.fn().mockResolvedValue(options?.allLots ?? []),
    },
    newSettlement: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'settlement-uuid-new', ...data }),
      ),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where.type === SettlementType.M0 && where.caseId) {
          return Promise.resolve(options?.existingM0 ?? null);
        }
        if (where.type === SettlementType.DELTA_1 && where.lotId) {
          return Promise.resolve(options?.delta1 ?? null);
        }
        return Promise.resolve(null);
      }),
    },
  } as any;
}

describe('SettlementHookService (CP4)', () => {
  let service: SettlementHookService;
  let mockLedger: ReturnType<typeof createMockLedgerService>;

  beforeEach(() => {
    mockLedger = createMockLedgerService();
    service = new SettlementHookService({} as any, mockLedger as any);
  });

  // ── createDelta1 ──

  describe('createDelta1 (Δ1 — 등급 가산)', () => {
    it('should create Δ1 settlement for A-grade lot', async () => {
      const rule = makeRule(PartType.BATTERY);
      const tx = createMockTx([rule]);

      const result = await service.createDelta1(
        { id: LOT_ID, partType: PartType.BATTERY, reuseGrade: 'A' },
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      expect(result).toBeDefined();
      // grossAmount = 500000 * 20% = 100000
      // feeAmount = 100000 * 0.05 = 5000
      // net = 95000
      expect(tx.newSettlement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: SettlementType.DELTA_1,
          grossAmount: 100000,
          feeRate: 0.05,
          feeAmount: 5000,
          amount: 95000,
          lotId: LOT_ID,
        }),
      });
    });

    it('should return null for D-grade (bonusRate = 0)', async () => {
      const rule = makeRule(PartType.BATTERY);
      const tx = createMockTx([rule]);

      const result = await service.createDelta1(
        { id: LOT_ID, partType: PartType.BATTERY, reuseGrade: 'D' },
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      expect(result).toBeNull();
      expect(tx.newSettlement.create).not.toHaveBeenCalled();
    });

    it('should return null when no rule exists', async () => {
      const tx = createMockTx([]);

      const result = await service.createDelta1(
        { id: LOT_ID, partType: PartType.OTHER, reuseGrade: 'A' },
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      expect(result).toBeNull();
    });

    it('should record SETTLEMENT_CREATED event', async () => {
      const rule = makeRule(PartType.BATTERY);
      const tx = createMockTx([rule]);

      await service.createDelta1(
        { id: LOT_ID, partType: PartType.BATTERY, reuseGrade: 'B' },
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      expect(mockLedger.appendEvent).toHaveBeenCalledWith(
        CASE_ID,
        YARD_USER_ID,
        EventType.SETTLEMENT_CREATED,
        expect.objectContaining({
          settlementType: 'DELTA_1',
          type: 'DELTA_1',
          lotId: LOT_ID,
        }),
        tx,
      );
    });
  });

  // ── onPurchaseCompleted ──

  describe('onPurchaseCompleted (M0 + Δ2)', () => {
    it('should create M0 when none exists, summing all lots', async () => {
      const batteryRule = makeRule(PartType.BATTERY, 500000);
      const motorRule = makeRule(PartType.MOTOR, 200000);
      const allLots = [
        { id: LOT_ID, partType: PartType.BATTERY, caseId: CASE_ID },
        { id: 'lot-2', partType: PartType.MOTOR, caseId: CASE_ID },
      ];
      const tx = createMockTx([batteryRule, motorRule], { allLots });

      await service.onPurchaseCompleted(
        { id: LOT_ID, partType: PartType.BATTERY, caseId: CASE_ID },
        { price: new Decimal(800000) },
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      // M0: 500000 + 200000 = 700000, fee = 35000, net = 665000
      expect(tx.newSettlement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: SettlementType.M0,
          grossAmount: 700000,
        }),
      });
    });

    it('should skip M0 if one already exists', async () => {
      const rule = makeRule(PartType.BATTERY);
      const tx = createMockTx([rule], {
        existingM0: { id: 'existing-m0', type: SettlementType.M0 },
      });

      await service.onPurchaseCompleted(
        { id: LOT_ID, partType: PartType.BATTERY, caseId: CASE_ID },
        { price: new Decimal(800000) },
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      // M0 생성 호출이 없어야 함 (Δ2만 생성)
      const createCalls = tx.newSettlement.create.mock.calls;
      const m0Calls = createCalls.filter(
        (c: any) => c[0].data.type === SettlementType.M0,
      );
      expect(m0Calls).toHaveLength(0);
    });

    it('should create Δ2 when salePrice > prevSettled', async () => {
      const rule = makeRule(PartType.BATTERY, 500000);
      const tx = createMockTx([rule], {
        existingM0: { id: 'existing-m0' },
        delta1: {
          id: 'delta1-id',
          grossAmount: new Decimal(100000),
        },
      });

      await service.onPurchaseCompleted(
        { id: LOT_ID, partType: PartType.BATTERY, caseId: CASE_ID },
        { price: new Decimal(800000) },
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      // prevSettled = 500000 (m0LotShare) + 100000 (Δ1 gross) = 600000
      // Δ2 gross = 800000 - 600000 = 200000
      // fee = 200000 * 0.05 = 10000
      // net = 190000
      expect(tx.newSettlement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: SettlementType.DELTA_2,
          grossAmount: 200000,
          feeAmount: 10000,
          amount: 190000,
          lotId: LOT_ID,
        }),
      });
    });

    it('should skip Δ2 when salePrice <= prevSettled (no negative)', async () => {
      const rule = makeRule(PartType.BATTERY, 500000);
      const tx = createMockTx([rule], {
        existingM0: { id: 'existing-m0' },
        delta1: {
          id: 'delta1-id',
          grossAmount: new Decimal(100000),
        },
      });

      await service.onPurchaseCompleted(
        { id: LOT_ID, partType: PartType.BATTERY, caseId: CASE_ID },
        { price: new Decimal(400000) }, // 400000 < 600000 prevSettled
        CASE_ID,
        YARD_USER_ID,
        tx,
      );

      const createCalls = tx.newSettlement.create.mock.calls;
      const d2Calls = createCalls.filter(
        (c: any) => c[0].data.type === SettlementType.DELTA_2,
      );
      expect(d2Calls).toHaveLength(0);
    });
  });
});
