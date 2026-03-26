import { IsEnum, IsObject } from 'class-validator';
import { PartType } from '@prisma/client';

export class CreateGradingRuleDto {
  @IsEnum(PartType)
  partType!: PartType;

  @IsObject()
  reuseConditions!: Record<string, any>;

  @IsObject()
  recycleConditions!: Record<string, any>;
}
