import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Delete,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ──────────────────────────────────────────────
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
  @ApiResponse({ status: 200, description: 'access/refresh token 반환' })
  @ApiResponse({ status: 401, description: 'OTP 불일치 또는 만료' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  // ──────────────────────────────────────────────
  // POST /auth/token/refresh
  // ──────────────────────────────────────────────
  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access Token 갱신' })
  @ApiResponse({ status: 200, description: '새 accessToken 반환' })
  @ApiResponse({ status: 401, description: 'Refresh token 무효/만료' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  // ──────────────────────────────────────────────
  // DELETE /auth/logout
  // ──────────────────────────────────────────────
  @Delete('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh Token 무효화 (로그아웃)' })
  @ApiResponse({ status: 204, description: '로그아웃 완료' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async logout(@Request() req: any) {
    // JWT payload에서 jti 추출
    if (req.user?.jti) {
      await this.authService.logout(req.user.jti);
    }
  }

  // ──────────────────────────────────────────────
  // GET /auth/me
  // ──────────────────────────────────────────────
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiResponse({ status: 200, description: '현재 인증된 유저 정보' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.sub);
  }
}
