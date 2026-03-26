import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  /**
   * 헬스 체크 엔드포인트
   * 서버 정상 동작 여부 확인용
   */
  @Get('health')
  @ApiOperation({ summary: '헬스 체크', description: 'API 서버 상태 확인' })
  @ApiResponse({
    status: 200,
    description: '서버 정상',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2025-01-01T00:00:00.000Z',
        uptime: 123.456,
        environment: 'development',
        version: '1.0.0',
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }

  /**
   * 루트 엔드포인트 - API 정보 반환
   */
  @Get()
  @ApiOperation({ summary: 'API 정보' })
  getRoot() {
    return {
      name: 'EVACYCLE API',
      description: '전기차 배터리 재활용 플랫폼',
      docs: '/api/docs',
      health: '/health',
    };
  }
}
