import { IsEnum, IsString, IsOptional, IsNumber, Min } from 'class-validator';
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

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  weightKg?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
