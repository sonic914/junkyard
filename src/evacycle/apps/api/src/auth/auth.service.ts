import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService, UserWithoutPassword } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthResponse {
  user: UserWithoutPassword;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // 회원가입
  // ──────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      phone: dto.phone,
      organizationId: dto.organizationId,
    });

    const tokens = this.generateTokens(user);

    return { user, tokens };
  }

  // ──────────────────────────────────────────────
  // 로그인
  // ──────────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthResponse> {
    const userWithPwd = await this.usersService.findByEmailWithPassword(
      dto.email,
    );

    if (!userWithPwd) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (!userWithPwd.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      userWithPwd.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // lastLoginAt 업데이트 (비동기, 응답 블로킹 불필요)
    void this.usersService.updateLastLogin(userWithPwd.id);

    // 비밀번호 해시를 제외한 유저 정보
    const { passwordHash: _, ...user } = userWithPwd;

    const tokens = this.generateTokens(user);

    return { user, tokens };
  }

  // ──────────────────────────────────────────────
  // 토큰 갱신
  // ──────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 refresh token입니다.');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    return this.generateTokens(user);
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────
  private generateTokens(user: UserWithoutPassword): AuthTokens {
    const jwtPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessExpiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
      '15m',
    );
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );

    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(jwtPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
    });

    // expiresIn 을 초 단위로 파싱 (예: '15m' → 900)
    const expiresInSeconds = this.parseExpiry(accessExpiresIn);

    return { accessToken, refreshToken, expiresIn: expiresInSeconds };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900;

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 1);
  }
}
