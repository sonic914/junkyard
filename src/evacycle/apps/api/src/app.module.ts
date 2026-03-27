import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { CasesModule } from './cases/cases.module';
import { FilesModule } from './files/files.module';
import { AdminModule } from './admin/admin.module';
import { GradingModule } from './grading/grading.module';
import { LotsModule } from './lots/lots.module';
import { SettlementsModule } from './settlements/settlements.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

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

    // 인증 모듈
    AuthModule,

    // Phase 1 모듈
    LedgerModule,
    CasesModule,

    // Phase 2 모듈
    FilesModule,
    AdminModule,

    // Phase 3 모듈
    GradingModule,
    LotsModule,

    // Phase 4 모듈
    SettlementsModule,
  ],
  controllers: [AppController],
  providers: [
    // 글로벌 JWT 인증 가드
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 글로벌 RBAC 역할 가드
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
