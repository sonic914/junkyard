import { IsString, MinLength } from 'class-validator';

export class RejectSettlementDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
