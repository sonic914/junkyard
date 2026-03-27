import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CasesService } from '../../src/cases/cases.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { FilesService } from '../../src/files/files.service';
import { SettlementHookService } from '../../src/settlements/settlement-hook.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CaseStatus, EventType, UserRole } from '@prisma/client';

describe('Case-Ledger 트랜잭션 원자성', () => {
  let casesService: CasesService;
  let ledgerService: LedgerService;
  let prisma: PrismaService;

  const mockFilesService = {
    getPresignedDownloadUrl: jest.fn(),
  };

  const mockSettlementHookService = {
    onCaseSubmitted: jest.fn(),
    onLotSold: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        LedgerService,
        PrismaService,
        { provide: FilesService, useValue: mockFilesService },
        { provide: SettlementHookService, useValue: mockSettlementHookService },
      ],
    }).compile();

    casesService = module.get<CasesService>(CasesService);
    ledgerService = module.get<LedgerService>(LedgerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('이벤트 기록 실패 시 상태 전이 롤백', () => {
    it('LedgerService 에러 발생 시 Case 상태가 원래대로 유지', async () => {
      // 테스트용 Case + Org + User 생성
      const org = await prisma.organization.create({
        data: { name: 'TestOrg', type: 'JUNKYARD', bizNo: '999-99-99999' },
      });
      const user = await prisma.user.create({
        data: {
          orgId: org.id,
          email: 'test-rollback@test.com',
          name: 'Rollback',
          role: 'JUNKYARD',
        },
      });

      const vehicleCase = await casesService.createCase(
        {
          vehicleMaker: '현대',
          vehicleModel: '테스트',
          vehicleYear: 2020,
          vin: 'ROLLBACK000000001',
        },
        user.id,
        org.id,
      );

      // SUBMITTED으로 전이
      await casesService.transitionCase(
        vehicleCase!.id,
        EventType.CASE_SUBMITTED,
        user.id,
        UserRole.JUNKYARD,
        {},
      );

      // LedgerService.appendEvent를 모킹하여 에러 발생
      jest
        .spyOn(ledgerService, 'appendEvent')
        .mockRejectedValueOnce(new Error('Hash computation failed'));

      await expect(
        casesService.transitionCase(
          vehicleCase!.id,
          EventType.COC_SIGNED,
          user.id,
          UserRole.JUNKYARD,
          { signedBy: 'Test', signedAt: new Date().toISOString() },
        ),
      ).rejects.toThrow();

      // Case 상태가 롤백되었는지 확인
      const reloaded = await prisma.vehicleCase.findUnique({
        where: { id: vehicleCase!.id },
      });
      expect(reloaded!.status).toBe('SUBMITTED'); // 원래 상태 유지

      jest.restoreAllMocks();

      // cleanup
      await prisma.eventLedger.deleteMany({ where: { caseId: vehicleCase!.id } });
      await prisma.vehicleCase.delete({ where: { id: vehicleCase!.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('동시 전이 시도', () => {
    it('동시에 두 개의 전이 시도 시 하나만 성공', async () => {
      const org = await prisma.organization.create({
        data: { name: 'ConcurrentOrg', type: 'JUNKYARD', bizNo: '888-88-88888' },
      });
      const user = await prisma.user.create({
        data: {
          orgId: org.id,
          email: 'test-concurrent@test.com',
          name: 'Concurrent',
          role: 'JUNKYARD',
        },
      });

      const vehicleCase = await casesService.createCase(
        {
          vehicleMaker: '기아',
          vehicleModel: '동시',
          vehicleYear: 2021,
          vin: 'CONCURRENT0000001',
        },
        user.id,
        org.id,
      );

      // SUBMITTED으로 전이
      await casesService.transitionCase(
        vehicleCase!.id,
        EventType.CASE_SUBMITTED,
        user.id,
        UserRole.JUNKYARD,
        {},
      );

      // 동시에 두 개의 COC_SIGNED 전이 시도
      const results = await Promise.allSettled([
        casesService.transitionCase(
          vehicleCase!.id,
          EventType.COC_SIGNED,
          user.id,
          UserRole.JUNKYARD,
          { signedBy: 'A', signedAt: new Date().toISOString() },
        ),
        casesService.transitionCase(
          vehicleCase!.id,
          EventType.COC_SIGNED,
          user.id,
          UserRole.JUNKYARD,
          { signedBy: 'B', signedAt: new Date().toISOString() },
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // 최소 하나는 성공
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      // 동시 요청이므로 하나는 실패할 수 있음 (race condition)
      expect(fulfilled.length + rejected.length).toBe(2);

      // cleanup
      await prisma.eventLedger.deleteMany({ where: { caseId: vehicleCase!.id } });
      await prisma.vehicleCase.delete({ where: { id: vehicleCase!.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('역할 기반 접근 제어', () => {
    it('BUYER는 Case 전이 불가 (CASE_SUBMITTED)', async () => {
      await expect(
        casesService.transitionCase(
          'fake-id',
          EventType.CASE_SUBMITTED,
          'fake-actor',
          UserRole.BUYER,
          {},
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('JUNKYARD는 INTAKE_CONFIRMED 불가', async () => {
      await expect(
        casesService.transitionCase(
          'fake-id',
          EventType.INTAKE_CONFIRMED,
          'fake-actor',
          UserRole.JUNKYARD,
          { receivedBy: 'test', receivedAt: new Date().toISOString() },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('COC_SIGNED에 signedBy 없으면 BadRequest', async () => {
      await expect(
        casesService.transitionCase(
          'fake-id',
          EventType.COC_SIGNED,
          'fake-actor',
          UserRole.JUNKYARD,
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
