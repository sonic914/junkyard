import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, seedTestData, cleanupTestData } from './setup';
import { getTestToken } from './helpers/auth.helper';

describe('Flow A — Cancel Flow (S2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: Awaited<ReturnType<typeof seedTestData>>;
  let yardToken: string;
  let caseId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    seed = await seedTestData(prisma);
    yardToken = await getTestToken(app, seed.yardUser);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  it('Step 1: Case 생성 → DRAFT', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/cases')
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        vehicleMaker: '기아',
        vehicleModel: 'EV6',
        vehicleYear: 2022,
        vin: 'KNAC381CBNA000001',
      })
      .expect(201);

    caseId = res.body.id;
    expect(res.body.status).toBe('DRAFT');
  });

  it('Step 2: Case 제출 → SUBMITTED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/submit`)
      .set('Authorization', `Bearer ${yardToken}`)
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');
  });

  it('Step 3: Case 취소 → CANCELLED + CASE_CANCELLED 이벤트', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/cancel`)
      .set('Authorization', `Bearer ${yardToken}`)
      .send({ reason: '차량 상태 불량' })
      .expect(201);

    expect(res.body.status).toBe('CANCELLED');

    // CASE_CANCELLED 이벤트 확인
    const events = await prisma.eventLedger.findMany({
      where: { caseId, eventType: 'CASE_CANCELLED' },
    });
    expect(events).toHaveLength(1);
    expect((events[0].payload as any).reason).toBe('차량 상태 불량');
  });

  it('Step 4: M0 Settlement 상태 확인 (PENDING 유지 — 별도 처리 필요)', async () => {
    const settlements = await prisma.newSettlement.findMany({
      where: { caseId, type: 'M0' },
    });
    // M0은 SUBMITTED 시점에 생성되었으므로 존재
    expect(settlements.length).toBeGreaterThanOrEqual(1);
  });

  it('Step 5: 취소된 Case에서 COC_SIGNED 시도 → 409', async () => {
    await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/transition`)
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        eventType: 'COC_SIGNED',
        payload: { signedBy: '김수거', signedAt: new Date().toISOString() },
      })
      .expect(409);
  });

  it('Step 6: 취소된 Case에서 CASE_SUBMITTED 시도 → 409', async () => {
    await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/submit`)
      .set('Authorization', `Bearer ${yardToken}`)
      .expect(409);
  });

  it('Step 7: 해시 체인 무결성 검증', async () => {
    const adminToken = await getTestToken(app, seed.adminUser);
    const res = await request(app.getHttpServer())
      .get('/v1/admin/ledger/verify')
      .query({ caseId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.valid).toBe(true);
  });
});

describe('Flow A — DRAFT 취소 (S2 변형)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: Awaited<ReturnType<typeof seedTestData>>;
  let yardToken: string;
  let caseId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    seed = await seedTestData(prisma);
    yardToken = await getTestToken(app, seed.yardUser);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  it('DRAFT 상태에서 직접 취소', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/cases')
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        vehicleMaker: '현대',
        vehicleModel: '아이오닉5',
        vehicleYear: 2023,
        vin: 'KMHJ281CBPA000002',
      })
      .expect(201);

    caseId = createRes.body.id;

    const cancelRes = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/cancel`)
      .set('Authorization', `Bearer ${yardToken}`)
      .send({ reason: '등록 실수' })
      .expect(201);

    expect(cancelRes.body.status).toBe('CANCELLED');

    // M0 Settlement 미생성 확인 (DRAFT에서 취소 → submit 하지 않았으므로)
    const settlements = await prisma.newSettlement.findMany({
      where: { caseId },
    });
    expect(settlements).toHaveLength(0);
  });
});
