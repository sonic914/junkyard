import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, seedTestData, cleanupTestData } from './setup';
import { getTestToken } from './helpers/auth.helper';
import {
  generateMockPresignedUrl,
  simulateMockUpload,
  validatePresignedUrl,
} from './helpers/minio.helper';

describe('Flow A — Happy Path (S1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: Awaited<ReturnType<typeof seedTestData>>;
  let yardToken: string;
  let hubToken: string;
  let buyerToken: string;
  let adminToken: string;
  let caseId: string;
  let lotId: string;
  let m0SettlementId: string;
  let deltaSettlementId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    seed = await seedTestData(prisma);

    yardToken = await getTestToken(app, seed.yardUser);
    hubToken = await getTestToken(app, seed.hubUser);
    buyerToken = await getTestToken(app, seed.buyerUser);
    adminToken = await getTestToken(app, seed.adminUser);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  it('Step 1: JUNKYARD — Case 생성 (DRAFT)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/cases')
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        vehicleMaker: '현대',
        vehicleModel: '아반떼',
        vehicleYear: 2020,
        vin: 'KMHD341CBLU123456',
      })
      .expect(201);

    caseId = res.body.id;
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.caseNo).toMatch(/^EVA-\d{6}-\d{5}$/);
  });

  it('Step 1.5: JUNKYARD — 파일 업로드 (presigned URL)', async () => {
    // Presigned URL 요청
    const presignedRes = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/files/presign`)
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        filename: '차량등록증.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(presignedRes.body.uploadUrl).toBeDefined();
    expect(presignedRes.body.key).toBeDefined();

    // Mock presigned URL 검증
    const mockPresigned = generateMockPresignedUrl(caseId, '차량등록증.pdf');
    expect(validatePresignedUrl(mockPresigned.uploadUrl)).toBe(true);

    // Mock 업로드 시뮬레이션
    const uploaded = simulateMockUpload(
      mockPresigned,
      '차량등록증.pdf',
      'application/pdf',
      102400,
    );
    expect(uploaded.key).toContain(`cases/${caseId}/files/`);
    expect(uploaded.contentType).toBe('application/pdf');
    expect(uploaded.size).toBe(102400);

    // 파일 메타데이터 등록
    const fileRes = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/files`)
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        filename: '차량등록증.pdf',
        contentType: 'application/pdf',
        size: 102400,
        key: presignedRes.body.key,
      })
      .expect(201);

    expect(fileRes.body.filename).toBe('차량등록증.pdf');
    expect(fileRes.body.caseId).toBe(caseId);
  });

  it('Step 2: JUNKYARD — Case 제출 (SUBMITTED) + M0 Settlement 자동생성', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/submit`)
      .set('Authorization', `Bearer ${yardToken}`)
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');

    // M0 Settlement 확인
    const settlements = await prisma.newSettlement.findMany({
      where: { caseId, type: 'M0' },
    });
    expect(settlements).toHaveLength(1);
    expect(settlements[0].status).toBe('PENDING');
    m0SettlementId = settlements[0].id;

    // M0 금액 검증: BATTERY(500000) + MOTOR(300000) + BODY(100000) = 900000
    expect(settlements[0].amount.toNumber()).toBe(900000);
  });

  it('Step 3: JUNKYARD — CoC 서명 (IN_TRANSIT)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/transition`)
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        eventType: 'COC_SIGNED',
        payload: {
          signedBy: '김수거',
          signedAt: new Date().toISOString(),
        },
      })
      .expect(201);

    expect(res.body.status).toBe('IN_TRANSIT');
  });

  it('Step 4: HUB — 입고 확인 (RECEIVED)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/transition`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({
        eventType: 'INTAKE_CONFIRMED',
        payload: {
          receivedBy: '박허브',
          receivedAt: new Date().toISOString(),
        },
      })
      .expect(201);

    expect(res.body.status).toBe('RECEIVED');
  });

  it('Step 5: HUB — 그레이딩 (BATTERY REUSE) + DerivedLot 생성', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/gradings`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({
        partType: 'BATTERY',
        reuseGrade: 'A',
        recycleGrade: 'R1',
        routingDecision: 'REUSE',
        notes: '배터리 용량 85% 이상',
      })
      .expect(201);

    expect(res.body.routingDecision).toBe('REUSE');

    // DerivedLot 생성 확인
    const lots = await prisma.derivedLot.findMany({
      where: { caseId },
    });
    expect(lots).toHaveLength(1);
    lotId = lots[0].id;
    expect(lots[0].partType).toBe('BATTERY');
  });

  it('Step 6: HUB — GRADING_SUBMITTED 전이', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/transition`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({
        eventType: 'GRADING_SUBMITTED',
        payload: {
          partType: 'BATTERY',
          reuseGrade: 'A',
          recycleGrade: 'R1',
          routingDecision: 'REUSE',
        },
      })
      .expect(201);

    expect(res.body.status).toBe('GRADING');
  });

  it('Step 7: HUB — Listing 생성 + ON_SALE 전이', async () => {
    const listingRes = await request(app.getHttpServer())
      .post(`/v1/lots/${lotId}/listings`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({ type: 'FIXED_PRICE', price: 1500000 })
      .expect(201);

    expect(listingRes.body.status).toBe('ACTIVE');

    // Case 상태 ON_SALE 확인
    const vehicleCase = await prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    expect(vehicleCase!.status).toBe('ON_SALE');
  });

  it('Step 8: BUYER — 구매 (SOLD) + DELTA Settlement 자동생성', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/lots/${lotId}/purchase`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);

    expect(res.body.status).toBe('SOLD');

    // DELTA Settlement 확인
    const deltas = await prisma.newSettlement.findMany({
      where: { caseId, type: 'DELTA' },
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0].status).toBe('PENDING');
    deltaSettlementId = deltas[0].id;

    // DELTA 금액 검증: 1,500,000 × 15% = 225,000
    expect(deltas[0].amount.toNumber()).toBe(225000);

    // Case 상태 SOLD
    const vehicleCase = await prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    expect(vehicleCase!.status).toBe('SOLD');
  });

  it('Step 9: ADMIN — M0 정산 승인 + 지급', async () => {
    // Approve
    await request(app.getHttpServer())
      .patch(`/v1/admin/settlements/${m0SettlementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    // Pay
    await request(app.getHttpServer())
      .patch(`/v1/admin/settlements/${m0SettlementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PAID' })
      .expect(200);

    const m0 = await prisma.newSettlement.findUnique({
      where: { id: m0SettlementId },
    });
    expect(m0!.status).toBe('PAID');
    expect(m0!.approvedBy).toBe(seed.adminUser.id);
    expect(m0!.paidAt).toBeDefined();
  });

  it('Step 10: ADMIN — DELTA 정산 승인 + 지급 → Case SETTLED', async () => {
    // Approve
    await request(app.getHttpServer())
      .patch(`/v1/admin/settlements/${deltaSettlementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    // Pay
    await request(app.getHttpServer())
      .patch(`/v1/admin/settlements/${deltaSettlementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PAID' })
      .expect(200);

    // Case SETTLED 확인
    const vehicleCase = await prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    expect(vehicleCase!.status).toBe('SETTLED');
  });

  it('Step 11: 해시 체인 무결성 검증', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/ledger/verify')
      .query({ caseId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.valid).toBe(true);
    expect(res.body.eventsVerified).toBeGreaterThanOrEqual(8);
  });

  it('Step 12: 타임라인 전체 이벤트 확인', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/cases/${caseId}/timeline`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.currentStatus).toBe('SETTLED');
    expect(res.body.hashChainValid).toBe(true);

    const eventTypes = res.body.timeline.map((t: any) => t.eventType);
    expect(eventTypes).toContain('CASE_CREATED');
    expect(eventTypes).toContain('CASE_SUBMITTED');
    expect(eventTypes).toContain('COC_SIGNED');
    expect(eventTypes).toContain('INTAKE_CONFIRMED');
    expect(eventTypes).toContain('GRADING_SUBMITTED');
    expect(eventTypes).toContain('PURCHASE_COMPLETED');
    expect(eventTypes).toContain('SETTLEMENT_APPROVED');
    expect(eventTypes).toContain('SETTLEMENT_PAID');
  });
});
