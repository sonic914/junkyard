import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, seedTestData, cleanupTestData } from './setup';
import { getTestToken } from './helpers/auth.helper';

describe('Batch Settlement Approval (S4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: Awaited<ReturnType<typeof seedTestData>>;
  let yardToken: string;
  let hubToken: string;
  let buyerToken: string;
  let adminToken: string;
  const caseIds: string[] = [];
  const settlementIds: string[] = [];

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

  it('Step 1: 여러 Case 생성 → 판매 완료 → PENDING Settlement 다건 누적', async () => {
    for (let i = 0; i < 3; i++) {
      // Create case
      const createRes = await request(app.getHttpServer())
        .post('/v1/cases')
        .set('Authorization', `Bearer ${yardToken}`)
        .send({
          vehicleMaker: '현대',
          vehicleModel: `모델-${i}`,
          vehicleYear: 2020 + i,
          vin: `KMHD341CBLU${String(100000 + i)}`,
        })
        .expect(201);
      const caseId = createRes.body.id;
      caseIds.push(caseId);

      // Submit
      await request(app.getHttpServer())
        .post(`/v1/cases/${caseId}/submit`)
        .set('Authorization', `Bearer ${yardToken}`)
        .expect(201);

      // CoC
      await request(app.getHttpServer())
        .post(`/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${yardToken}`)
        .send({
          eventType: 'COC_SIGNED',
          payload: { signedBy: '김수거', signedAt: new Date().toISOString() },
        })
        .expect(201);

      // Intake
      await request(app.getHttpServer())
        .post(`/v1/cases/${caseId}/transition`)
        .set('Authorization', `Bearer ${hubToken}`)
        .send({
          eventType: 'INTAKE_CONFIRMED',
          payload: { receivedBy: '박허브', receivedAt: new Date().toISOString() },
        })
        .expect(201);

      // Grading
      await request(app.getHttpServer())
        .post(`/v1/cases/${caseId}/gradings`)
        .set('Authorization', `Bearer ${hubToken}`)
        .send({
          partType: 'BATTERY',
          reuseGrade: 'A',
          recycleGrade: 'R1',
          routingDecision: 'REUSE',
        })
        .expect(201);

      // GRADING_SUBMITTED
      await request(app.getHttpServer())
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

      // Get lot
      const lots = await prisma.derivedLot.findMany({ where: { caseId } });
      const lotId = lots[0].id;

      // Listing
      await request(app.getHttpServer())
        .post(`/v1/lots/${lotId}/listings`)
        .set('Authorization', `Bearer ${hubToken}`)
        .send({ type: 'FIXED_PRICE', price: 1000000 })
        .expect(201);

      // Purchase
      await request(app.getHttpServer())
        .post(`/v1/lots/${lotId}/purchase`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(201);
    }

    // PENDING Settlement 수집
    const allSettlements = await prisma.newSettlement.findMany({
      where: {
        caseId: { in: caseIds },
        status: 'PENDING',
      },
    });

    // 3 Cases × (1 M0 + 1 DELTA) = 6 PENDING settlements
    expect(allSettlements.length).toBe(6);
    settlementIds.push(...allSettlements.map((s) => s.id));
  });

  it('Step 2: 일괄 정산 승인 (batch-approve)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/settlements/batch-approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: settlementIds })
      .expect(201);

    expect(res.body.approved).toBe(6);

    // 모든 Settlement APPROVED 확인
    const settlements = await prisma.newSettlement.findMany({
      where: { id: { in: settlementIds } },
    });
    expect(settlements.every((s) => s.status === 'APPROVED')).toBe(true);

    // 각 이벤트 원장 기록 확인
    for (const cid of caseIds) {
      const events = await prisma.eventLedger.findMany({
        where: { caseId: cid, eventType: 'SETTLEMENT_APPROVED' },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('Step 3: 일괄 PAY 처리 → 관련 Case들 SETTLED 전이', async () => {
    // PAY each settlement individually
    for (const sid of settlementIds) {
      await request(app.getHttpServer())
        .patch(`/v1/admin/settlements/${sid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PAID' })
        .expect(200);
    }

    // 모든 Case SETTLED 확인
    for (const cid of caseIds) {
      const vehicleCase = await prisma.vehicleCase.findUnique({
        where: { id: cid },
      });
      expect(vehicleCase!.status).toBe('SETTLED');
    }
  });

  it('Step 4: 이미 APPROVED인 Settlement에 batch-approve → 409', async () => {
    // 새로운 PENDING settlement이 없으므로 기존 ID 재사용
    await request(app.getHttpServer())
      .post('/v1/admin/settlements/batch-approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: [settlementIds[0]] })
      .expect(409);
  });
});
