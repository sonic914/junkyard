/**
 * COD-59: CHARGER GradingRule + SettlementRule 시드
 * 실행: npx ts-node prisma/seed-charger-rule.ts
 */
import { PrismaClient, PartType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CHARGER rules...');

  // GradingRule - CHARGER
  const gradingRule = await prisma.gradingRule.upsert({
    where: {
      partType_version: { partType: PartType.CHARGER, version: 1 },
    },
    update: {},
    create: {
      partType: PartType.CHARGER,
      reuseConditions: {
        A: { maxAgeYears: 5, outputPowerMinW: 7400 },   // 7.4kW 이상
        B: { maxAgeYears: 7, outputPowerMinW: 3300 },   // 3.3kW 이상
        C: { maxAgeYears: 10, outputPowerMinW: 1800 },  // 1.8kW 이상
        D: { note: '재사용 불가 판정, 재활용으로 전환' },
      },
      recycleConditions: {
        R1: { minPurity: 85 },
        R2: { minPurity: 70 },
        R3: { minPurity: 50 },
      },
      version: 1,
      isActive: true,
    },
  });

  // SettlementRule - CHARGER
  const settlementRule = await prisma.settlementRule.upsert({
    where: {
      partType_version: { partType: PartType.CHARGER, version: 1 },
    },
    update: {},
    create: {
      partType: PartType.CHARGER,
      m0BaseAmount: 150000,    // 기본 15만원
      deltaRatio: 10.00,       // 10% 추가
      gradeBonusMap: {
        A: 20.0,   // +20%
        B: 10.0,   // +10%
        C: 5.0,    // +5%
        D: 0.0,
      },
      platformFeeRate: 0.05,
      currency: 'KRW',
      version: 1,
      isActive: true,
    },
  });

  console.log('✅ CHARGER rules seeded');
  console.log('   GradingRule id:', gradingRule.id);
  console.log('   SettlementRule id:', settlementRule.id);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
