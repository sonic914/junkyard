import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const env = configService.get<string>('app.env', 'development');

  // 쿠키 파서 (httpOnly refreshToken 쿠키 읽기 위해 필요)
  app.use(cookieParser());

  // API 버전 관리
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 글로벌 파이프 (유효성 검사)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS 설정
  // credentials: true 시 origin: '*' 은 브라우저 차단 → 명시적 origin 필요
  const rawOrigin = configService.get<string>('app.corsOrigin', 'http://localhost:3001');
  const allowedOrigins = rawOrigin === '*'
    ? true  // 와일드카드는 boolean true로 처리 (credentials 없는 환경)
    : rawOrigin.split(',').map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-token'],
  });

  // Swagger (개발 환경에서만 활성화)
  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EVACYCLE API')
      .setDescription('EV 폐차 부품 재활용 플랫폼 API — Auth, Cases, Grading, Lots, Settlements, Admin')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'access-token',
      )
      .addTag('Auth', '인증 (OTP + JWT)')
      .addTag('Users', '사용자 관리')
      .addTag('Cases', 'Case 등록 및 상태 관리')
      .addTag('Events', '이벤트 원장 (EventLedger)')
      .addTag('Files', '파일 업로드 (MinIO)')
      .addTag('Gradings', '듀얼 그레이딩')
      .addTag('Lots', 'DerivedLot + Listing 마켓플레이스')
      .addTag('Settlements', '정산 조회')
      .addTag('Admin', '관리자 도구')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`🚀 EVACYCLE API running on http://localhost:${port}`);
  console.log(`   Environment: ${env}`);
}

bootstrap();
