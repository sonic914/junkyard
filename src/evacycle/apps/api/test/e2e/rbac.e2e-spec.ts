import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, seedTestData, cleanupTestData } from './setup';
import { getTestToken } from './helpers/auth.helper';

describe('RBAC — Negative Cases (403/401)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: Awaited<ReturnType<typeof seedTestData>>;
  let buyerToken: string;
  let yardToken: string;
  let caseId: string;
  let settlementId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    seed = await seedTestData(prisma);

    buyerToken = await getTestToken(app, seed.buyerUser);
    yardToken = await getTestToken(app, seed.yardUser);

    // JUNKYARD로 Case + Settlement 생성 (테스트 데이터)
    const adminToken = await getTestToken(app, seed.adminUser);
    const caseRes = await request(app.getHttpServer())
      .post('/v1/cases')
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        vehicleMaker: '현대',
        vehicleModel: '아반떼',
        vehicleYear: 2020,
        vin: 'KMHD341CBLU999999',
      })
      .expect(201);

    caseId = caseRes.body.id;

    // Submit → M0 Settlement 자동 생성
    await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/submit`)
      .set('Authorization', `Bearer ${yardToken}`)
      .expect(201);

    const settlements = await prisma.newSettlement.findMany({
      where: { caseId, type: 'M0' },
    });
    settlementId = settlements[0].id;
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  it('TC1: BUYER가 POST /v1/cases → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/cases')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        vehicleMaker: '기아',
        vehicleModel: 'K5',
        vehicleYear: 2021,
        vin: 'KNAE351CBLU000001',
      })
      .expect(403);

    expect(res.body.message).toBeDefined();
  });

  it('TC2: JUNKYARD가 PATCH /v1/admin/settlements/:id → 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/settlements/${settlementId}`)
      .set('Authorization', `Bearer ${yardToken}`)
      .send({ status: 'APPROVED' })
      .expect(403);

    expect(res.body.message).toBeDefined();
  });

  it('TC3: 토큰 없이 GET /v1/cases → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/cases')
      .expect(401);

    expect(res.body.message).toBeDefined();
  });

  it('TC4: BUYER가 POST /v1/cases/:id/gradings → 403', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/gradings`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        partType: 'BATTERY',
        reuseGrade: 'A',
        recycleGrade: 'R1',
        routingDecision: 'REUSE',
        notes: 'RBAC 테스트',
      })
      .expect(403);

    expect(res.body.message).toBeDefined();
  });

  it('TC5: JUNKYARD가 POST /v1/admin/settlements/batch-approve → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/settlements/batch-approve')
      .set('Authorization', `Bearer ${yardToken}`)
      .send({ settlementIds: [settlementId] })
      .expect(403);

    expect(res.body.message).toBeDefined();
  });
});
