import { PrismaClient, UserRole, OrganizationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 조직 생성
  const manufacturer = await prisma.organization.upsert({
    where: { name: '현대자동차' },
    update: {},
    create: {
      name: '현대자동차',
      type: OrganizationType.MANUFACTURER,
      bizNumber: '123-45-67890',
      address: '서울특별시 서초구 헌릉로 12',
      phone: '02-3464-1114',
      email: 'contact@hyundai.com',
    },
  });

  const recycler = await prisma.organization.upsert({
    where: { name: '에코배터리 재활용' },
    update: {},
    create: {
      name: '에코배터리 재활용',
      type: OrganizationType.RECYCLER,
      bizNumber: '987-65-43210',
      address: '경기도 안산시 단원구 산단로 123',
      phone: '031-123-4567',
      email: 'info@ecobattery.co.kr',
    },
  });

  // 슈퍼 관리자 생성
  const passwordHash = await bcrypt.hash('Admin1234!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@evacycle.io' },
    update: {},
    create: {
      email: 'admin@evacycle.io',
      passwordHash,
      name: '시스템 관리자',
      role: UserRole.SUPER_ADMIN,
    },
  });

  // 조직 관리자 생성
  const orgAdminHash = await bcrypt.hash('OrgAdmin1234!', 10);
  await prisma.user.upsert({
    where: { email: 'org-admin@hyundai.com' },
    update: {},
    create: {
      email: 'org-admin@hyundai.com',
      passwordHash: orgAdminHash,
      name: '홍길동',
      role: UserRole.ORG_ADMIN,
      organizationId: manufacturer.id,
    },
  });

  console.log('✅ Seed completed');
  console.log('   Organizations:', [manufacturer.name, recycler.name]);
  console.log('   Admin: admin@evacycle.io / Admin1234!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
