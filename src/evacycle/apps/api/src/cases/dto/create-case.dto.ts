import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  vehicleMaker!: string;

  @IsString()
  vehicleModel!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  vehicleYear!: number;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
