import { IsEnum, IsInt, IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { PartType } from '@prisma/client';

export class CreateLotDto {
  @IsEnum(PartType)
  partType!: PartType;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number = 1;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  weightKg!: number;

  @IsString()
  @IsOptional()
  description?: string;
}
