import { IsString, IsOptional } from 'class-validator';

export class PaySettlementDto {
  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  txReference?: string;
}
