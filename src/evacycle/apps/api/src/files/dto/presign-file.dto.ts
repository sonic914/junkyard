import { IsString, IsEnum, IsOptional, IsUUID, IsNumber, Max, Min } from 'class-validator';
import { FileType } from '@prisma/client';

export class PresignFileDto {
  @IsString()
  fileName!: string;

  @IsEnum(FileType)
  fileType!: FileType;

  @IsString()
  contentType!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20 * 1024 * 1024) // 20MB max
  fileSize?: number;

  @IsOptional()
  @IsUUID()
  eventId?: string;
}
