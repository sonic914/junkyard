import { IsEnum, IsString, IsOptional } from 'class-validator';
import { PartType, ReuseGrade, RecycleGrade, RoutingDecision } from '@prisma/client';

export class CreateGradingDto {
  @IsEnum(PartType)
  partType!: PartType;

  @IsEnum(ReuseGrade)
  reuseGrade!: ReuseGrade;

  @IsEnum(RecycleGrade)
  recycleGrade!: RecycleGrade;

  @IsEnum(RoutingDecision)
  routingDecision!: RoutingDecision;

  @IsString()
  @IsOptional()
  notes?: string;
}
