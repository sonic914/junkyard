import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@evacycle.io' })
  @IsEmail({}, { message: '유효한 이메일을 입력하세요.' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP는 6자리 숫자입니다.' })
  otp!: string;
}
