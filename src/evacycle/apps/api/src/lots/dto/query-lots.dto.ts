import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  PartType,
  ReuseGrade,
  RecycleGrade,
  RoutingDecision,
  LotStatus,
} from '@prisma/client';

export class QueryLotsDto {
  @IsEnum(PartType)
  @IsOptional()
  partType?: PartType;

  @IsEnum(ReuseGrade)
  @IsOptional()
  reuseGrade?: ReuseGrade;

  @IsEnum(RecycleGrade)
  @IsOptional()
  recycleGrade?: RecycleGrade;

  @IsEnum(RoutingDecision)
  @IsOptional()
  routingDecision?: RoutingDecision;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @IsEnum(LotStatus)
  @IsOptional()
  status?: LotStatus;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  skip?: number = 0;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Max(100)
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
