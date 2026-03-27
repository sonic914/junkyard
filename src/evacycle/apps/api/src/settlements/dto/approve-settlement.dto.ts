import { IsString, IsOptional } from 'class-validator';

export class ApproveSettlementDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
