import { IsNumber, IsString, IsOptional, Length, Min } from 'class-validator';

export class CreateListingDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  price!: number;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string = 'KRW';
}
