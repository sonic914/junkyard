/**
 * demo-seed.ts — EVACYCLE C-Level 데모용 시드 데이터
 *
 * 실행: npx ts-node prisma/demo-seed.ts
 * 주의: demo.bat에서 --force-reset 이후 실행됨 (기존 데이터 전체 삭제 후 삽입)
 */

import {
  PrismaClient,
  UserRole,
  OrgType,
  CaseStatus,
  EventType,
  PartType,
  RoutingDecision,
  ReuseGrade,
  LotStatus,
  ListingStatus,
  SettlementType,
  SettlementStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ─── 해시 유틸 (EventLedger 체인) ─────────────────────────────────────────
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
function computeHash(prevHash: string, payload: object): string {
  return sha256(`${prevHash}${JSON.stringify(payload)}`);
}

// ─── 메인 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 EVACYCLE 데모 시드 시작...\n');

  // ── 1. 조직 생성 ──────────────────────────────────────────────────────────
  console.log('  [1/6] 조직 생성...');

  const platform = await prisma.organization.create({
    data: {
      name: 'EVACYCLE 플랫폼',
      type: OrgType.PLATFORM,
      bizNumber: '000-00-00000',
      address: '서울특별시 강남구 테헤란로 123',
      phone: '02-1234-5678',
      email: 'platform@evacycle.com',
    },
  });

  const junkyard = await prisma.organization.create({
    data: {
      name: '서울 폐차장',
      type: OrgType.JUNKYARD,
      bizNumber: '101-23-45678',
      address: '경기도 시흥시 공단로 45',
      phone: '031-999-1234',
      email: 'info@seoul-junkyard.co.kr',
    },
  });

  const hub = await prisma.organization.create({
    data: {
      name: '경기 배터리 허브',
      type: OrgType.HUB,
      bizNumber: '202-34-56789',
      address: '경기도 화성시 산단4로 67',
      phone: '031-555-7890',
      email: 'intake@gg-hub.co.kr',
    },
  });

  const buyerOrg = await prisma.organization.create({
    data: {
      name: '에코배터리 주식회사',
      type: OrgType.BUYER,
      bizNumber: '303-45-67890',
      address: '인천광역시 연수구 테크노파크로 89',
      phone: '032-444-5678',
      email: 'purchase@ecobattery.co.kr',
    },
  });

  // ── 2. 사용자 생성 ────────────────────────────────────────────────────────
  console.log('  [2/6] 사용자 생성...');

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@evacycle.com',
      name: '관리자 김철수',
      role: UserRole.ADMIN,
      organizationId: platform.id,
    },
  });

  const junkyardUser = await prisma.user.create({
    data: {
      email: 'junkyard@evacycle.com',
      name: '폐차장 이영희',
      role: UserRole.JUNKYARD,
      organizationId: junkyard.id,
    },
  });

  const hubUser = await prisma.user.create({
    data: {
      email: 'hub@evacycle.com',
      name: '허브 박민준',
      role: UserRole.HUB,
      organizationId: hub.id,
    },
  });

  const buyerUser = await prisma.user.create({
    data: {
      email: 'buyer@evacycle.com',
      name: '바이어 최지은',
      role: UserRole.BUYER,
      organizationId: buyerOrg.id,
    },
  });

  // ── 3. 정산 규칙 생성 ─────────────────────────────────────────────────────
  console.log('  [3/6] 정산 규칙 생성...');

  await prisma.settlementRule.createMany({
    data: [
      {
        partType: PartType.BATTERY,
        m0BaseAmount: 150000,
        deltaRatio: 15.0,
        gradeBonusMap: { A: 20.0, B: 10.0, C: 5.0, D: 0.0 },
        platformFeeRate: 0.05,
        description: '배터리 표준 정산 규칙',
      },
      {
        partType: PartType.MOTOR,
        m0BaseAmount: 80000,
        deltaRatio: 12.0,
        gradeBonusMap: { A: 15.0, B: 8.0, C: 3.0, D: 0.0 },
        platformFeeRate: 0.05,
        description: '모터 표준 정산 규칙',
      },
    ],
  });

  // ── 4. 케이스 3개 생성 ────────────────────────────────────────────────────
  console.log('  [4/6] 케이스 생성 (DRAFT / SUBMITTED / IN_TRANSIT)...');

  // 공통 이벤트 원장 생성 헬퍼
  async function addLedgerEvent(
    caseId: string,
    actorId: string,
    seq: number,
    eventType: EventType,
    payload: object,
    prevHash: string,
  ): Promise<string> {
    const createdAt = new Date();
    const selfHash = computeHash(prevHash, { caseId, seq, eventType, payload, createdAt });
    await prisma.eventLedger.create({
      data: { caseId, actorId, seq, eventType, payload, prevHash, selfHash, createdAt },
    });
    return selfHash;
  }

  // Case 1 — DRAFT (방금 등록된 케이스)
  const case1 = await prisma.vehicleCase.create({
    data: {
      orgId: junkyard.id,
      createdBy: junkyardUser.id,
      caseNo: 'DEMO-2026-001',
      vin: 'KMHEC41DBPA000001',
      vehicleMaker: '현대',
      vehicleModel: '아이오닉5',
      vehicleYear: 2021,
      status: CaseStatus.DRAFT,
      notes: '데모용 케이스 — 등록 단계',
    },
  });
  await addLedgerEvent(case1.id, junkyardUser.id, 1, EventType.CASE_CREATED,
    { caseNo: case1.caseNo, vin: case1.vin }, '0'.repeat(64));

  // Case 2 — SUBMITTED (제출 완료, 허브 배정 대기)
  const case2 = await prisma.vehicleCase.create({
    data: {
      orgId: junkyard.id,
      hubOrgId: hub.id,
      createdBy: junkyardUser.id,
      caseNo: 'DEMO-2026-002',
      vin: 'KMHEC41DBPA000002',
      vehicleMaker: '기아',
      vehicleModel: 'EV6',
      vehicleYear: 2022,
      status: CaseStatus.SUBMITTED,
      notes: '데모용 케이스 — 제출 완료, CoC 서명 완료',
    },
  });
  let h2 = await addLedgerEvent(case2.id, junkyardUser.id, 1, EventType.CASE_CREATED,
    { caseNo: case2.caseNo }, '0'.repeat(64));
  h2 = await addLedgerEvent(case2.id, junkyardUser.id, 2, EventType.CASE_SUBMITTED,
    { submittedAt: new Date().toISOString() }, h2);
  await addLedgerEvent(case2.id, junkyardUser.id, 3, EventType.COC_SIGNED,
    { signerName: junkyardUser.name, signedAt: new Date().toISOString() }, h2);

  // Case 3 — IN_TRANSIT (운송 중 → 허브 도착 임박, 데모 하이라이트)
  const case3 = await prisma.vehicleCase.create({
    data: {
      orgId: junkyard.id,
      intakeOrgId: hub.id,
      hubOrgId: hub.id,
      createdBy: junkyardUser.id,
      caseNo: 'DEMO-2026-003',
      vin: 'KMHEC41DBPA000003',
      vehicleMaker: '현대',
      vehicleModel: '코나 EV',
      vehicleYear: 2020,
      status: CaseStatus.IN_TRANSIT,
      notes: '데모용 케이스 — 운송 중, 허브 도착 예정',
    },
  });
  let h3 = await addLedgerEvent(case3.id, junkyardUser.id, 1, EventType.CASE_CREATED,
    { caseNo: case3.caseNo }, '0'.repeat(64));
  h3 = await addLedgerEvent(case3.id, junkyardUser.id, 2, EventType.CASE_SUBMITTED,
    { submittedAt: new Date().toISOString() }, h3);
  h3 = await addLedgerEvent(case3.id, junkyardUser.id, 3, EventType.COC_SIGNED,
    { signerName: junkyardUser.name }, h3);
  await addLedgerEvent(case3.id, hubUser.id, 4, EventType.INTAKE_CONFIRMED,
    { receivedBy: hubUser.name, note: '운송 중' }, h3);

  // ── 5. Lot + Listing 생성 (ON_SALE 상태) ──────────────────────────────────
  console.log('  [5/6] Lot + Listing 생성 (ON_SALE)...');

  // ON_SALE용 케이스 추가 (GRADING 완료 상태)
  const case4 = await prisma.vehicleCase.create({
    data: {
      orgId: junkyard.id,
      intakeOrgId: hub.id,
      hubOrgId: hub.id,
      createdBy: junkyardUser.id,
      caseNo: 'DEMO-2026-004',
      vin: 'KMHEC41DBPA000004',
      vehicleMaker: '테슬라',
      vehicleModel: 'Model 3',
      vehicleYear: 2019,
      status: CaseStatus.ON_SALE,
      notes: '데모용 케이스 — 그레이딩 완료, Lot 판매 중',
    },
  });

  const lot = await prisma.derivedLot.create({
    data: {
      caseId: case4.id,
      lotNo: 'LOT-DEMO-2026-001',
      partType: PartType.BATTERY,
      routingDecision: RoutingDecision.REUSE,
      reuseGrade: ReuseGrade.A,
      weightKg: 450.5,
      quantity: 1,
      status: LotStatus.ON_SALE,
      description: '테슬라 Model 3 배터리 팩 — Grade A, 용량 잔존율 91%',
    },
  });

  await prisma.listing.create({
    data: {
      lotId: lot.id,
      type: 'FIXED_PRICE',
      price: 1850000,
      currency: 'KRW',
      status: ListingStatus.ACTIVE,
    },
  });

  // ── 6. 샘플 정산 생성 (PENDING) ───────────────────────────────────────────
  console.log('  [6/6] 샘플 정산 생성...');

  await prisma.newSettlement.create({
    data: {
      caseId: case4.id,
      lotId: lot.id,
      yardUserId: junkyardUser.id,
      type: SettlementType.M0,
      status: SettlementStatus.PENDING,
      grossAmount: 150000,
      feeRate: 0.05,
      feeAmount: 7500,
      amount: 142500,
      currency: 'KRW',
      ruleSnapshot: { partType: 'BATTERY', m0BaseAmount: 150000, platformFeeRate: 0.05 },
      calcDetail: { base: 150000, feeRate: '5%', feeAmount: 7500, netAmount: 142500 },
    },
  });

  // ── 완료 출력 ─────────────────────────────────────────────────────────────
  console.log('\n✅ 데모 시드 완료!\n');
  console.log('  [조직]');
  console.log(`    플랫폼: ${platform.name}`);
  console.log(`    폐차장: ${junkyard.name}`);
  console.log(`    허브:   ${hub.name}`);
  console.log(`    바이어: ${buyerOrg.name}`);
  console.log('\n  [계정] (OTP 로그인 — 개발 환경에서 콘솔 확인)');
  console.log(`    관리자:  ${adminUser.email}`);
  console.log(`    폐차장:  ${junkyardUser.email}`);
  console.log(`    허브:    ${hubUser.email}`);
  console.log(`    바이어:  ${buyerUser.email}`);
  console.log('\n  [케이스]');
  console.log(`    DEMO-2026-001  DRAFT        현대 아이오닉5 (2021)`);
  console.log(`    DEMO-2026-002  SUBMITTED    기아 EV6 (2022)`);
  console.log(`    DEMO-2026-003  IN_TRANSIT   현대 코나 EV (2020)`);
  console.log(`    DEMO-2026-004  ON_SALE      테슬라 Model 3 (2019)`);
  console.log('\n  [Lot]');
  console.log(`    LOT-DEMO-2026-001  배터리 Grade A  ₩1,850,000  판매 중`);
  console.log('\n  [정산]');
  console.log(`    M0 정산  ₩142,500 (수수료 5% 차감)  PENDING\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ 데모 시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
