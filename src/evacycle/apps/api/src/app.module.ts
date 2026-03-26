import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // 환경변수 전역 설정
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting (분당 100건)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Prisma 데이터베이스 모듈
    PrismaModule,

    // TODO: 기능 모듈들 (Phase 1 구현 시 추가)
    // AuthModule,
    // UsersModule,
    // OrganizationsModule,
    // VehicleCasesModule,
    // EventLedgerModule,
    // SettlementsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
