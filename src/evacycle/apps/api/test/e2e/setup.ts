import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();
  return app;
}

export async function seedTestData(prisma: PrismaService) {
  // 1. Platform Organization
  const platformOrg = await prisma.organization.create({
    data: { name: 'EVACYCLE', type: 'PLATFORM', bizNo: '000-00-00000' },
  });

  // 2. Junkyard Organization
  const yardOrg = await prisma.organization.create({
    data: { name: '서울폐차장', type: 'JUNKYARD', bizNo: '123-45-67890' },
  });

  // 3. HUB Organization
  const hubOrg = await prisma.organization.create({
    data: { name: '경기허브센터', type: 'HUB', bizNo: '234-56-78901' },
  });

  // 4. Buyer Organization
  const buyerOrg = await prisma.organization.create({
    data: { name: '그린리사이클', type: 'BUYER', bizNo: '345-67-89012' },
  });

  // 5. Users (역할별)
  const adminUser = await prisma.user.create({
    data: {
      orgId: platformOrg.id,
      email: 'admin@evacycle.com',
      name: '관리자',
      role: 'ADMIN',
    },
  });
  const yardUser = await prisma.user.create({
    data: {
      orgId: yardOrg.id,
      email: 'yard@test.com',
      name: '김수거',
      role: 'JUNKYARD',
    },
  });
  const hubUser = await prisma.user.create({
    data: {
      orgId: hubOrg.id,
      email: 'hub@test.com',
      name: '박허브',
      role: 'HUB',
    },
  });
  const buyerUser = await prisma.user.create({
    data: {
      orgId: buyerOrg.id,
      email: 'buyer@test.com',
      name: '이구매',
      role: 'BUYER',
    },
  });

  // 6. GradingRule 시드
  await prisma.gradingRule.createMany({
    data: [
      {
        partType: 'BATTERY',
        reuseConditions: { A: { maxAge: 5, minCapacity: 80 } },
        recycleConditions: { R1: { minPurity: 90 } },
        version: 1,
        isActive: true,
      },
      {
        partType: 'MOTOR',
        reuseConditions: { A: { maxAge: 7 } },
        recycleConditions: { R1: { minPurity: 85 } },
        version: 1,
        isActive: true,
      },
      {
        partType: 'BODY',
        reuseConditions: { A: { maxAge: 10 } },
        recycleConditions: { R1: { minPurity: 70 } },
        version: 1,
        isActive: true,
      },
    ],
  });

  // 7. SettlementRule 시드
  await prisma.settlementRule.createMany({
    data: [
      {
        partType: 'BATTERY',
        m0BaseAmount: 500000,
        deltaRatio: 15.0,
        version: 1,
        isActive: true,
      },
      {
        partType: 'MOTOR',
        m0BaseAmount: 300000,
        deltaRatio: 12.0,
        version: 1,
        isActive: true,
      },
      {
        partType: 'BODY',
        m0BaseAmount: 100000,
        deltaRatio: 10.0,
        version: 1,
        isActive: true,
      },
    ],
  });

  return {
    platformOrg,
    yardOrg,
    hubOrg,
    buyerOrg,
    adminUser,
    yardUser,
    hubUser,
    buyerUser,
  };
}

export async function cleanupTestData(prisma: PrismaService) {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"${name}"`)
    .join(', ');

  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`);
  }
}
