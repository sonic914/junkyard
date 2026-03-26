import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { FileType } from '@prisma/client';

export class PresignFileDto {
  @IsString()
  fileName!: string;

  @IsEnum(FileType)
  fileType!: FileType;

  @IsString()
  contentType!: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;
}
