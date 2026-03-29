import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from './decorators/public.decorator';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ──────────────────────────────────────────────
  // GET /auth/otp/peek?email=... (dev only)
  @Public()
  @Get('otp/peek')
  async peekOtp(@Query('email') email: string, @Res() res: Response) {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: 'dev only' });
    }
    const otp = await this.authService.peekOtp(email);
    return res.json({ otp });
  }

  // POST /auth/otp/send
  // ──────────────────────────────────────────────
  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OTP 이메일 발송' })
  @ApiResponse({ status: 200, description: 'OTP 발송 완료' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.email);
  }

  // ──────────────────────────────────────────────
  // POST /auth/otp/verify
  // ──────────────────────────────────────────────
  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OTP 검증 + JWT 발급' })
  @ApiResponse({ status: 200, description: 'accessToken + user 반환, refreshToken은 httpOnly 쿠키로 발급' })
  @ApiResponse({ status: 401, description: 'OTP 불일치 또는 만료' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto.email, dto.otp);

    // ✅ refreshToken → httpOnly 쿠키 (XSS 방어)
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    // accessToken + user만 JSON 응답 (refreshToken 바디 제거)
    return { accessToken: result.accessToken, user: result.user };
  }

  // ──────────────────────────────────────────────
  // POST /auth/token/refresh
  // ──────────────────────────────────────────────
  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access Token 갱신 (refreshToken은 쿠키로 전송)' })
  @ApiResponse({ status: 200, description: '새 accessToken 반환' })
  @ApiResponse({ status: 401, description: 'Refresh token 무효/만료' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token 쿠키가 없습니다.');
    }

    const result = await this.authService.refreshToken(refreshToken);

    // 쿠키 maxAge 갱신 (슬라이딩 만료)
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    return { accessToken: result.accessToken };
  }

  // ──────────────────────────────────────────────
  // POST /auth/logout
  // ──────────────────────────────────────────────
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '로그아웃 — refreshToken 쿠키 삭제 + Redis 무효화' })
  @ApiResponse({ status: 204, description: '로그아웃 완료' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 쿠키에서 refreshToken 읽어 Redis 무효화 (jti 추출)
    const refreshToken = req.cookies?.['refreshToken'];
    if (refreshToken) {
      try {
        await this.authService.logoutByRefreshToken(refreshToken);
      } catch {
        // 무효한 토큰이어도 쿠키는 삭제
      }
    }
    res.clearCookie('refreshToken', { path: '/' });
  }

  // ──────────────────────────────────────────────
  // GET /auth/me
  // ──────────────────────────────────────────────
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiResponse({ status: 200, description: '현재 인증된 유저 정보' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.sub);
  }
}
