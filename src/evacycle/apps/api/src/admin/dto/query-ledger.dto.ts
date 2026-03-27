import { IsEnum, IsOptional, IsUUID, IsInt, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '@prisma/client';

export class QueryLedgerDto {
  @IsUUID()
  @IsOptional()
  caseId?: string;

  @IsEnum(EventType)
  @IsOptional()
  eventType?: EventType;

  @IsUUID()
  @IsOptional()
  actorId?: string;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  skip?: number = 0;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  @Type(() => Number)
  take?: number = 50;
}
