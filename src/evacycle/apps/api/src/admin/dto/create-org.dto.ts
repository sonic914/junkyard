import { IsString, IsEnum, IsOptional } from 'class-validator';
import { OrgType } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  name!: string;

  @IsEnum(OrgType)
  type!: OrgType;

  @IsString()
  businessNo!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
