import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const env = configService.get<string>('app.env', 'development');

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
  app.enableCors({
    origin: configService.get<string>('app.corsOrigin', '*'),
    credentials: true,
  });

  // Swagger (개발 환경에서만 활성화)
  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EVACYCLE API')
      .setDescription('전기차 배터리 재활용 플랫폼 REST API')
      .setVersion('1.0')
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
      .addTag('auth', '인증 / 로그인')
      .addTag('users', '사용자 관리')
      .addTag('organizations', '조직 관리')
      .addTag('vehicle-cases', '차량 배터리 케이스')
      .addTag('event-ledger', '이벤트 원장')
      .addTag('settlements', '정산 관리')
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
