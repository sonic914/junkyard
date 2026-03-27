import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface TestUser {
  id: string;
  email: string;
  role: string;
  orgId: string;
}

/**
 * JWT 토큰 직접 생성 (OTP bypass)
 * E2E 테스트에서 인증 플로우를 우회하고 유효한 토큰을 발급
 */
export async function getTestToken(
  app: INestApplication,
  user: TestUser,
): Promise<string> {
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
  };

  return jwtService.sign(payload, {
    secret: configService.get<string>('jwt.accessSecret', 'test-access-secret'),
    expiresIn: '1h',
  });
}
