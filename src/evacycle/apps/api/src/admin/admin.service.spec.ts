import { NotFoundException } from '@nestjs/common';
import { UserRole, CaseStatus, SettlementStatus, EventType, PartType, LotStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AdminService } from './admin.service';
import { computeSelfHash } from '../ledger/hash.util';

// ── Mock Helpers ──

function createMockPrisma(overrides: Record<string, any> = {}) {
  return {
    vehicleCase: {
      groupBy: jest.fn().mockResolvedValue([
        { status: CaseStatus.SUBMITTED, _count: 10 },
        { status: CaseStatus.SOLD, _count: 5 },
      ]),
    },
    derivedLot: {
      groupBy: jest.fn().mockResolvedValue([
        { status: LotStatus.ON_SALE, _count: 8, partType: undefined },
        { status: LotStatus.SOLD, _count: 12, partType: undefined },
      ]),
    },
    newSettlement: {
      groupBy: jest.fn().mockResolvedValue([
        { status: SettlementStatus.PENDING, _count: 3, _sum: { amount: new Decimal(1500000) } },
        { status: SettlementStatus.APPROVED, _count: 5, _sum: { amount: new Decimal(3500000) } },
        { status: SettlementStatus.PAID, _count: 10, _sum: { amount: new Decimal(12000000) } },
      ]),
    },
    user: {
      groupBy: jest.fn().mockResolvedValue([
        { role: UserRole.ADMIN, _count: 2 },
        { role: UserRole.JUNKYARD, _count: 10 },
      ]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    eventLedger: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    ...overrides,
  } as any;
}

// ── getDashboard ──

describe('AdminService — getDashboard', () => {
  it('should aggregate case, lot, settlement, and user counts', async () => {
    const prisma = createMockPrisma();

    // derivedLot.groupBy is called twice (byStatus, byPartType)
    prisma.derivedLot.groupBy
      .mockResolvedValueOnce([
        { status: LotStatus.ON_SALE, _count: 8 },
        { status: LotStatus.SOLD, _count: 12 },
      ])
      .mockResolvedValueOnce([
        { partType: PartType.BATTERY, _count: 10 },
        { partType: PartType.MOTOR, _count: 10 },
      ]);

    // newSettlement.groupBy is called twice (byStatus count, byStatus sum)
    prisma.newSettlement.groupBy
      .mockResolvedValueOnce([
        { status: SettlementStatus.PENDING, _count: 3 },
        { status: SettlementStatus.APPROVED, _count: 5 },
        { status: SettlementStatus.PAID, _count: 10 },
      ])
      .mockResolvedValueOnce([
        { status: SettlementStatus.PENDING, _sum: { amount: new Decimal(1500000) } },
        { status: SettlementStatus.APPROVED, _sum: { amount: new Decimal(3500000) } },
        { status: SettlementStatus.PAID, _sum: { amount: new Decimal(12000000) } },
      ]);

    const service = new AdminService(prisma);
    const result = await service.getDashboard();

    expect(result.cases.total).toBe(15); // 10 + 5
    expect(result.cases.byStatus['SUBMITTED']).toBe(10);
    expect(result.lots.total).toBe(20); // 8 + 12
    expect(result.lots.byPartType['BATTERY']).toBe(10);
    expect(result.settlements.total).toBe(18); // 3 + 5 + 10
    expect(result.settlements.totalAmountPending).toBe('1500000');
    expect(result.settlements.totalAmountApproved).toBe('3500000');
    expect(result.settlements.totalAmountPaid).toBe('12000000');
    expect(result.users.total).toBe(12); // 2 + 10
    expect(result.generatedAt).toBeDefined();
  });

  it('should return zero amounts when no settlements exist', async () => {
    const prisma = createMockPrisma();
    prisma.derivedLot.groupBy.mockResolvedValue([]);
    prisma.newSettlement.groupBy.mockResolvedValue([]);
    prisma.vehicleCase.groupBy.mockResolvedValue([]);
    prisma.user.groupBy.mockResolvedValue([]);

    const service = new AdminService(prisma);
    const result = await service.getDashboard();

    expect(result.settlements.total).toBe(0);
    expect(result.settlements.totalAmountPending).toBe('0');
    expect(result.settlements.totalAmountApproved).toBe('0');
    expect(result.settlements.totalAmountPaid).toBe('0');
  });
});

// ── findAllUsers / updateUser ──

describe('AdminService — User Management', () => {
  it('should return paginated user list with settlement stats', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'yard@example.com',
        name: 'Kim',
        role: UserRole.JUNKYARD,
        orgId: 'org-1',
        org: { id: 'org-1', name: 'TestOrg' },
        isActive: true,
        createdAt: new Date(),
        _count: { createdCases: 5 },
      },
    ];
    const prisma = createMockPrisma({
      user: {
        findMany: jest.fn().mockResolvedValue(mockUsers),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      newSettlement: {
        groupBy: jest.fn().mockResolvedValue([
          { yardUserId: 'user-1', _sum: { amount: new Decimal(5600000) } },
        ]),
      },
    });

    const service = new AdminService(prisma);
    const result = await service.findAllUsers(undefined, undefined, 0, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].orgName).toBe('TestOrg');
    expect(result.data[0].stats.casesCount).toBe(5);
    expect(result.data[0].stats.settlementsTotal).toBe('5600000');
    expect(result.total).toBe(1);
  });

  it('should filter users by role', async () => {
    const prisma = createMockPrisma({
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      newSettlement: { groupBy: jest.fn().mockResolvedValue([]) },
    });

    const service = new AdminService(prisma);
    await service.findAllUsers(UserRole.JUNKYARD, undefined, 0, 20);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: UserRole.JUNKYARD }),
      }),
    );
  });

  it('should search users by name or email (ILIKE)', async () => {
    const prisma = createMockPrisma({
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      newSettlement: { groupBy: jest.fn().mockResolvedValue([]) },
    });

    const service = new AdminService(prisma);
    await service.findAllUsers(undefined, 'kim', 0, 20);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'kim', mode: 'insensitive' } },
            { email: { contains: 'kim', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('should update user role', async () => {
    const prisma = createMockPrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.JUNKYARD }),
        update: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.ADMIN }),
      },
    });

    const service = new AdminService(prisma);
    const result = await service.updateUser('u1', { role: UserRole.ADMIN });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: UserRole.ADMIN },
    });
    expect(result.role).toBe(UserRole.ADMIN);
  });

  it('should toggle user isActive', async () => {
    const prisma = createMockPrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
        update: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }),
      },
    });

    const service = new AdminService(prisma);
    await service.updateUser('u1', { isActive: false });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: false },
    });
  });

  it('should throw NotFoundException when user does not exist', async () => {
    const prisma = createMockPrisma({
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    const service = new AdminService(prisma);
    await expect(
      service.updateUser('non-existent', { role: UserRole.ADMIN }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ── verifyLedger ──

describe('AdminService — verifyLedger', () => {
  function makeEvent(caseId: string, seq: number, prevHash: string, payload: Record<string, unknown> = {}) {
    const createdAt = new Date('2026-03-27T10:00:00.000Z');
    const selfHash = computeSelfHash({
      caseId,
      seq,
      eventType: EventType.CASE_SUBMITTED,
      actorId: 'actor-1',
      prevHash,
      payload,
      createdAt,
    });
    return {
      caseId,
      seq,
      eventType: EventType.CASE_SUBMITTED,
      actorId: 'actor-1',
      prevHash,
      selfHash,
      payload,
      createdAt,
      case: { caseNo: `EVA-${caseId}` },
    };
  }

  it('should return valid=true for correct hash chain', async () => {
    const e1 = makeEvent('c1', 1, '0'.repeat(64));
    const e2 = makeEvent('c1', 2, e1.selfHash);

    const prisma = createMockPrisma({
      eventLedger: {
        findMany: jest.fn().mockResolvedValue([e1, e2]),
      },
    });

    const service = new AdminService(prisma);
    const result = await service.verifyLedger('c1');

    expect(result.valid).toBe(true);
    expect(result.eventsVerified).toBe(2);
    expect(result.casesVerified).toBe(1);
    expect(result.errors).toBeUndefined();
  });

  it('should detect tampered selfHash', async () => {
    const e1 = makeEvent('c1', 1, '0'.repeat(64));
    const tampered = { ...e1, selfHash: 'tampered_hash_value' };

    const prisma = createMockPrisma({
      eventLedger: {
        findMany: jest.fn().mockResolvedValue([tampered]),
      },
    });

    const service = new AdminService(prisma);
    const result = await service.verifyLedger('c1');

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0].actualHash).toBe('tampered_hash_value');
  });

  it('should detect broken prevHash chain', async () => {
    const e1 = makeEvent('c1', 1, '0'.repeat(64));
    // e2 has wrong prevHash (should be e1.selfHash)
    const e2 = makeEvent('c1', 2, 'wrong_prev_hash');

    const prisma = createMockPrisma({
      eventLedger: {
        findMany: jest.fn().mockResolvedValue([e1, e2]),
      },
    });

    const service = new AdminService(prisma);
    const result = await service.verifyLedger('c1');

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.seq === 2)).toBe(true);
  });

  it('should handle multiple cases independently', async () => {
    const c1e1 = makeEvent('c1', 1, '0'.repeat(64));
    const c2e1 = makeEvent('c2', 1, '0'.repeat(64));

    const prisma = createMockPrisma({
      eventLedger: {
        findMany: jest.fn().mockResolvedValue([c1e1, c2e1]),
      },
    });

    const service = new AdminService(prisma);
    const result = await service.verifyLedger();

    expect(result.valid).toBe(true);
    expect(result.casesVerified).toBe(2);
  });

  it('should return valid=true for empty event list', async () => {
    const prisma = createMockPrisma({
      eventLedger: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const service = new AdminService(prisma);
    const result = await service.verifyLedger();

    expect(result.valid).toBe(true);
    expect(result.eventsVerified).toBe(0);
    expect(result.casesVerified).toBe(0);
  });
});
