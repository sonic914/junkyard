import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './guards/jwt-auth.guard';

/** 인증이 필요 없는 엔드포인트 마킹 */
const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ──────────────────────────────────────────────
  // POST /auth/register
  // ──────────────────────────────────────────────
  @Public()
  @Post('register')
  @ApiOperation({ summary: '회원가입' })
  @ApiResponse({ status: 201, description: '회원가입 성공 — access/refresh token 반환' })
  @ApiResponse({ status: 409, description: '이메일 중복' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      message: '회원가입이 완료되었습니다.',
      user: result.user,
      tokens: result.tokens,
    };
  }

  // ──────────────────────────────────────────────
  // POST /auth/login
  // ──────────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인' })
  @ApiResponse({ status: 200, description: '로그인 성공 — access/refresh token 반환' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      message: '로그인에 성공했습니다.',
      user: result.user,
      tokens: result.tokens,
    };
  }

  // ──────────────────────────────────────────────
  // POST /auth/refresh
  // ──────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access Token 갱신' })
  @ApiResponse({ status: 200, description: '새 access/refresh token 반환' })
  @ApiResponse({ status: 401, description: 'Refresh token 무효/만료' })
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refresh(dto.refreshToken);
    return {
      message: '토큰이 갱신되었습니다.',
      tokens,
    };
  }

  // ──────────────────────────────────────────────
  // GET /auth/me  (인증 확인용)
  // ──────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiResponse({ status: 200, description: '현재 인증된 유저 정보' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  getMe(@Request() req: { user: any }) {
    return { user: req.user };
  }
}
