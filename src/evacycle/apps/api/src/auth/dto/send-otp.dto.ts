import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: 'user@evacycle.io' })
  @IsEmail({}, { message: '유효한 이메일을 입력하세요.' })
  email!: string;
}
