import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SettlementStatus } from '@prisma/client';

export class UpdateSettlementDto {
  @IsEnum(SettlementStatus)
  status!: SettlementStatus; // APPROVED, PAID, REJECTED

  @IsString()
  @IsOptional()
  rejectedReason?: string; // REJECTED일 때 필수

  @IsString()
  @IsOptional()
  notes?: string;
}
