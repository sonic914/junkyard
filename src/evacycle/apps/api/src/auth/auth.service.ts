import {
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ──────────────────────────────────────────────
  // OTP 발송
  // ──────────────────────────────────────────────
  async sendOtp(email: string): Promise<{ message: string; expiresIn: number }> {
    const otp = String(randomInt(100000, 999999));
    const ttl = this.configService.get<number>('OTP_TTL_SECONDS', 300);

    await this.redis.set(`otp:${email}`, otp, 'EX', ttl);

    // TODO: nodemailer로 실제 이메일 발송 (SMTP 설정에 의존)
    // 발송 실패해도 200 반환 (이메일 존재 여부 노출 방지)

    return { message: 'OTP sent', expiresIn: ttl };
  }

  // ──────────────────────────────────────────────
  // OTP 검증 + JWT 발급
  // ──────────────────────────────────────────────
  async verifyOtp(email: string, otp: string): Promise<AuthTokens & { user: any }> {
    const stored = await this.redis.get(`otp:${email}`);

    if (!stored || stored !== otp) {
      throw new UnauthorizedException('OTP가 올바르지 않거나 만료되었습니다.');
    }

    await this.redis.del(`otp:${email}`);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('등록되지 않았거나 비활성화된 계정입니다.');
    }

    // lastLoginAt 업데이트
    void this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Refresh Token
  // ──────────────────────────────────────────────
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    let payload: any;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 refresh token입니다.');
    }

    // Redis에서 refresh:{jti} 유효성 확인
    const exists = await this.redis.exists(`refresh:${payload.jti}`);
    if (!exists) {
      throw new UnauthorizedException('이미 무효화된 refresh token입니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn', '15m');

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, orgId: user.orgId },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: accessExpiresIn,
      },
    );

    return { accessToken, expiresIn: this.parseExpiry(accessExpiresIn) };
  }

  // ──────────────────────────────────────────────
  // Logout
  // ──────────────────────────────────────────────
  async logout(jti: string): Promise<void> {
    await this.redis.del(`refresh:${jti}`);
  }

  // ──────────────────────────────────────────────
  // 내 정보 조회
  // ──────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────
  private generateTokens(user: { id: string; email: string; role: string; orgId: string }): AuthTokens {
    const jti = randomUUID();

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
    };

    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn', '15m');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { ...jwtPayload, jti },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    // refresh:{jti}를 Redis에 저장 (TTL 7d)
    const refreshTtl = this.parseExpiry(refreshExpiresIn);
    void this.redis.set(`refresh:${jti}`, 'valid', 'EX', refreshTtl);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(accessExpiresIn),
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
