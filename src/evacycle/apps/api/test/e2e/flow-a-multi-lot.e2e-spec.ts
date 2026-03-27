import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, seedTestData, cleanupTestData } from './setup';
import { getTestToken } from './helpers/auth.helper';

describe('Flow A — Multi-Lot Settlement (S3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: Awaited<ReturnType<typeof seedTestData>>;
  let yardToken: string;
  let hubToken: string;
  let buyerToken: string;
  let adminToken: string;
  let caseId: string;
  let batteryLotId: string;
  let motorLotId: string;

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

  it('Step 1~4: Case 생성 → SUBMITTED → IN_TRANSIT → RECEIVED', async () => {
    // Create
    const createRes = await request(app.getHttpServer())
      .post('/v1/cases')
      .set('Authorization', `Bearer ${yardToken}`)
      .send({
        vehicleMaker: '테슬라',
        vehicleModel: 'Model 3',
        vehicleYear: 2021,
        vin: 'TSLA341CBLU999999',
      })
      .expect(201);
    caseId = createRes.body.id;

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
    const intakeRes = await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/transition`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({
        eventType: 'INTAKE_CONFIRMED',
        payload: { receivedBy: '박허브', receivedAt: new Date().toISOString() },
      })
      .expect(201);

    expect(intakeRes.body.status).toBe('RECEIVED');
  });

  it('Step 5: Grading ×3 — BATTERY(REUSE), MOTOR(RECYCLE), BODY(DISCARD)', async () => {
    // BATTERY — REUSE
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

    // MOTOR — RECYCLE
    await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/gradings`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({
        partType: 'MOTOR',
        reuseGrade: 'C',
        recycleGrade: 'R1',
        routingDecision: 'RECYCLE',
      })
      .expect(201);

    // BODY — DISCARD
    await request(app.getHttpServer())
      .post(`/v1/cases/${caseId}/gradings`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({
        partType: 'BODY',
        reuseGrade: 'D',
        recycleGrade: 'R3',
        routingDecision: 'DISCARD',
      })
      .expect(201);

    // DerivedLot 검증: BATTERY + MOTOR만 (DISCARD는 Lot 미생성)
    const lots = await prisma.derivedLot.findMany({
      where: { caseId },
      orderBy: { partType: 'asc' },
    });
    expect(lots).toHaveLength(2);
    expect(lots.map((l) => l.partType).sort()).toEqual(['BATTERY', 'MOTOR']);

    batteryLotId = lots.find((l) => l.partType === 'BATTERY')!.id;
    motorLotId = lots.find((l) => l.partType === 'MOTOR')!.id;
  });

  it('Step 6: GRADING_SUBMITTED 전이', async () => {
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
  });

  it('Step 7: 각 Lot Listing + 판매', async () => {
    // BATTERY Lot — Listing + Purchase
    await request(app.getHttpServer())
      .post(`/v1/lots/${batteryLotId}/listings`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({ type: 'FIXED_PRICE', price: 1500000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/lots/${batteryLotId}/purchase`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);

    // MOTOR Lot — Listing + Purchase
    await request(app.getHttpServer())
      .post(`/v1/lots/${motorLotId}/listings`)
      .set('Authorization', `Bearer ${hubToken}`)
      .send({ type: 'FIXED_PRICE', price: 800000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/lots/${motorLotId}/purchase`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);

    // Case SOLD 확인 (모든 Lot SOLD)
    const vehicleCase = await prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    expect(vehicleCase!.status).toBe('SOLD');
  });

  it('Step 8: Settlement 검증 — M0 ×1 + DELTA ×2', async () => {
    const settlements = await prisma.newSettlement.findMany({
      where: { caseId },
      orderBy: { type: 'asc' },
    });

    // DELTA ×2 + M0 ×1 = 3
    expect(settlements).toHaveLength(3);

    const m0 = settlements.filter((s) => s.type === 'M0');
    const deltas = settlements.filter((s) => s.type === 'DELTA');
    expect(m0).toHaveLength(1);
    expect(deltas).toHaveLength(2);

    // M0 금액: BATTERY(500000) + MOTOR(300000) + BODY(100000) = 900000
    expect(m0[0].amount.toNumber()).toBe(900000);

    // DELTA 금액: BATTERY(1500000 × 15% = 225000), MOTOR(800000 × 12% = 96000)
    const batteryDelta = deltas.find((d) => d.lotId === batteryLotId);
    const motorDelta = deltas.find((d) => d.lotId === motorLotId);
    expect(batteryDelta!.amount.toNumber()).toBe(225000);
    expect(motorDelta!.amount.toNumber()).toBe(96000);
  });

  it('Step 9: 전체 정산 승인 + 지급 → Case SETTLED', async () => {
    const settlements = await prisma.newSettlement.findMany({
      where: { caseId },
    });

    for (const s of settlements) {
      // Approve
      await request(app.getHttpServer())
        .patch(`/v1/admin/settlements/${s.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      // Pay
      await request(app.getHttpServer())
        .patch(`/v1/admin/settlements/${s.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PAID' })
        .expect(200);
    }

    // Case SETTLED 전이 확인
    const vehicleCase = await prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    expect(vehicleCase!.status).toBe('SETTLED');
  });

  it('Step 10: 해시 체인 무결성 검증', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/ledger/verify')
      .query({ caseId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.valid).toBe(true);
    // 많은 이벤트 (create, submit, coc, intake, grading_submitted, listing×2, purchase×2, settlement events)
    expect(res.body.eventsVerified).toBeGreaterThanOrEqual(10);
  });
});
