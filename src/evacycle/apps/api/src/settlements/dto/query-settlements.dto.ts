import { IsEnum, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SettlementType, SettlementStatus } from '@prisma/client';

export class QuerySettlementsDto {
  @IsEnum(SettlementType)
  @IsOptional()
  type?: SettlementType;

  @IsEnum(SettlementStatus)
  @IsOptional()
  status?: SettlementStatus;

  @IsUUID()
  @IsOptional()
  caseId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  skip?: number = 0;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  take?: number = 20;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
