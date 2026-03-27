import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsObject,
  Length,
  Min,
  Max,
} from 'class-validator';
import { PartType } from '@prisma/client';

export class CreateSettlementRuleDto {
  @IsEnum(PartType)
  partType!: PartType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  m0BaseAmount!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  deltaRatio!: number;

  @IsObject()
  @IsOptional()
  gradeBonusMap?: Record<string, number>; // { "A": 20.0, "B": 10.0, ... }

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  @IsOptional()
  platformFeeRate?: number;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string = 'KRW';

  @IsString()
  @IsOptional()
  description?: string;
}
