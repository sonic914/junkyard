import { IsString, MinLength } from 'class-validator';

export class CancelCaseDto {
  @IsString()
  @MinLength(10)
  reason!: string;
}
