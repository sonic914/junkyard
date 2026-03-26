import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CaseStatus, EventType, UserRole } from '@prisma/client';
import { CasesService } from './cases.service';

// Minimal mock types
const mockLedgerService = {
  appendEvent: jest.fn().mockResolvedValue({
    id: 'event-1',
    seq: 2,
    eventType: EventType.CASE_SUBMITTED,
    selfHash: 'abc123',
    createdAt: new Date(),
  }),
  findAllByCaseId: jest.fn().mockResolvedValue([]),
  verifyChain: jest.fn().mockResolvedValue({ isValid: true, brokenAt: null }),
};

const mockFilesService = {
  getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://minio/file'),
};

function createMockPrisma(vehicleCase: any) {
  const txClient = {
    vehicleCase: {
      findUnique: jest.fn().mockResolvedValue(vehicleCase),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...vehicleCase, ...data }),
      ),
    },
  };
  return {
    $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
    vehicleCase: txClient.vehicleCase,
    user: { findUnique: jest.fn() },
    caseFile: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

function createService(vehicleCase: any) {
  const prisma = createMockPrisma(vehicleCase);
  const service = new CasesService(prisma, mockLedgerService as any, mockFilesService as any);
  return { service, prisma };
}

const CASE_ID = 'case-uuid-1';
const ACTOR_ID = 'actor-uuid-1';

function makeCase(status: CaseStatus) {
  return {
    id: CASE_ID,
    caseNo: 'EVA-202603-00001',
    status,
    orgId: 'org-1',
    vehicleMaker: '현대',
    vehicleModel: '아반떼',
    vehicleYear: 2020,
  };
}

describe('CasesService.transitionCase()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Allowed transitions ────────────────────────────

  it('should allow CASE_SUBMITTED from DRAFT by OWNER', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    const result = await service.transitionCase(
      CASE_ID, EventType.CASE_SUBMITTED, ACTOR_ID, UserRole.OWNER,
    );
    expect(result.status).toBe(CaseStatus.SUBMITTED);
  });

  it('should allow COC_SIGNED from SUBMITTED by JUNKYARD', async () => {
    const { service } = createService(makeCase(CaseStatus.SUBMITTED));
    const result = await service.transitionCase(
      CASE_ID, EventType.COC_SIGNED, ACTOR_ID, UserRole.JUNKYARD,
      { signedBy: '김폐차', signedAt: '2026-03-27T10:00:00Z' },
    );
    expect(result.status).toBe(CaseStatus.IN_TRANSIT);
  });

  it('should allow INTAKE_CONFIRMED from IN_TRANSIT by HUB', async () => {
    const { service } = createService(makeCase(CaseStatus.IN_TRANSIT));
    const result = await service.transitionCase(
      CASE_ID, EventType.INTAKE_CONFIRMED, ACTOR_ID, UserRole.HUB,
      { receivedBy: '박허브', receivedAt: '2026-03-27T14:00:00Z' },
    );
    expect(result.status).toBe(CaseStatus.RECEIVED);
  });

  it('should allow CASE_CANCELLED from DRAFT by OWNER', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    const result = await service.transitionCase(
      CASE_ID, EventType.CASE_CANCELLED, ACTOR_ID, UserRole.OWNER,
      { reason: '차주 사정으로 폐차 취소합니다' },
    );
    expect(result.status).toBe(CaseStatus.CANCELLED);
  });

  it('should allow CASE_CANCELLED from SUBMITTED by JUNKYARD', async () => {
    const { service } = createService(makeCase(CaseStatus.SUBMITTED));
    const result = await service.transitionCase(
      CASE_ID, EventType.CASE_CANCELLED, ACTOR_ID, UserRole.JUNKYARD,
      { reason: '서류 미비로 인한 취소 처리' },
    );
    expect(result.status).toBe(CaseStatus.CANCELLED);
  });

  it('should allow ADMIN to perform any transition', async () => {
    const { service } = createService(makeCase(CaseStatus.SUBMITTED));
    const result = await service.transitionCase(
      CASE_ID, EventType.COC_SIGNED, ACTOR_ID, UserRole.ADMIN,
      { signedBy: '관리자', signedAt: '2026-03-27T10:00:00Z' },
    );
    expect(result.status).toBe(CaseStatus.IN_TRANSIT);
  });

  // ── Denied: wrong role ────────────────────────────

  it('should deny OWNER from performing COC_SIGNED', async () => {
    const { service } = createService(makeCase(CaseStatus.SUBMITTED));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.COC_SIGNED, ACTOR_ID, UserRole.OWNER,
        { signedBy: '차주', signedAt: '2026-03-27T10:00:00Z' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should deny BUYER from performing CASE_SUBMITTED', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    await expect(
      service.transitionCase(CASE_ID, EventType.CASE_SUBMITTED, ACTOR_ID, UserRole.BUYER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should deny JUNKYARD from performing INTAKE_CONFIRMED', async () => {
    const { service } = createService(makeCase(CaseStatus.IN_TRANSIT));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.INTAKE_CONFIRMED, ACTOR_ID, UserRole.JUNKYARD,
        { receivedBy: '폐차장', receivedAt: '2026-03-27T14:00:00Z' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should deny OWNER from performing INTAKE_CONFIRMED', async () => {
    const { service } = createService(makeCase(CaseStatus.IN_TRANSIT));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.INTAKE_CONFIRMED, ACTOR_ID, UserRole.OWNER,
        { receivedBy: '차주', receivedAt: '2026-03-27T14:00:00Z' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Denied: wrong status ──────────────────────────

  it('should deny CASE_SUBMITTED from SUBMITTED (already submitted)', async () => {
    const { service } = createService(makeCase(CaseStatus.SUBMITTED));
    await expect(
      service.transitionCase(CASE_ID, EventType.CASE_SUBMITTED, ACTOR_ID, UserRole.ADMIN),
    ).rejects.toThrow(ConflictException);
  });

  it('should deny COC_SIGNED from DRAFT (not yet submitted)', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.COC_SIGNED, ACTOR_ID, UserRole.ADMIN,
        { signedBy: '관리자', signedAt: '2026-03-27T10:00:00Z' },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should deny INTAKE_CONFIRMED from SUBMITTED (must be IN_TRANSIT)', async () => {
    const { service } = createService(makeCase(CaseStatus.SUBMITTED));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.INTAKE_CONFIRMED, ACTOR_ID, UserRole.ADMIN,
        { receivedBy: '관리자', receivedAt: '2026-03-27T14:00:00Z' },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should deny CASE_CANCELLED from IN_TRANSIT', async () => {
    const { service } = createService(makeCase(CaseStatus.IN_TRANSIT));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.CASE_CANCELLED, ACTOR_ID, UserRole.ADMIN,
        { reason: '이미 운송 중이라 취소 불가' },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should deny CASE_CANCELLED from RECEIVED', async () => {
    const { service } = createService(makeCase(CaseStatus.RECEIVED));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.CASE_CANCELLED, ACTOR_ID, UserRole.ADMIN,
        { reason: '입고 완료 후 취소 불가' },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should deny any transition from CANCELLED (terminal state)', async () => {
    const { service } = createService(makeCase(CaseStatus.CANCELLED));
    await expect(
      service.transitionCase(CASE_ID, EventType.CASE_SUBMITTED, ACTOR_ID, UserRole.ADMIN),
    ).rejects.toThrow(ConflictException);
  });

  // ── Denied: missing required payload ──────────────

  it('should deny COC_SIGNED without signedBy', async () => {
    const { service } = createService(makeCase(CaseStatus.SUBMITTED));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.COC_SIGNED, ACTOR_ID, UserRole.JUNKYARD,
        { signedAt: '2026-03-27T10:00:00Z' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should deny INTAKE_CONFIRMED without receivedBy/receivedAt', async () => {
    const { service } = createService(makeCase(CaseStatus.IN_TRANSIT));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.INTAKE_CONFIRMED, ACTOR_ID, UserRole.HUB,
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should deny CASE_CANCELLED without reason', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    await expect(
      service.transitionCase(
        CASE_ID, EventType.CASE_CANCELLED, ACTOR_ID, UserRole.OWNER,
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Case not found ────────────────────────────────

  it('should throw NotFoundException when case does not exist', async () => {
    const { service } = createService(null);
    await expect(
      service.transitionCase(CASE_ID, EventType.CASE_SUBMITTED, ACTOR_ID, UserRole.ADMIN),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Convenience wrappers ──────────────────────────

  it('submitCase() should delegate to transitionCase with CASE_SUBMITTED', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    const result = await service.submitCase(CASE_ID, ACTOR_ID, UserRole.OWNER);
    expect(result.status).toBe(CaseStatus.SUBMITTED);
  });

  it('cancelCase() should delegate to transitionCase with CASE_CANCELLED', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    const result = await service.cancelCase(CASE_ID, ACTOR_ID, UserRole.OWNER, '테스트 취소 사유입니다');
    expect(result.status).toBe(CaseStatus.CANCELLED);
  });

  // ── Event recorded with statusFrom/statusTo ───────

  it('should pass statusFrom and statusTo in the event payload', async () => {
    const { service } = createService(makeCase(CaseStatus.DRAFT));
    await service.transitionCase(CASE_ID, EventType.CASE_SUBMITTED, ACTOR_ID, UserRole.OWNER);
    expect(mockLedgerService.appendEvent).toHaveBeenCalledWith(
      CASE_ID,
      ACTOR_ID,
      EventType.CASE_SUBMITTED,
      expect.objectContaining({
        statusFrom: CaseStatus.DRAFT,
        statusTo: CaseStatus.SUBMITTED,
      }),
      expect.anything(), // tx
    );
  });
});
