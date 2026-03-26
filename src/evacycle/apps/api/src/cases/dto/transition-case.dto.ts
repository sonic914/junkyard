import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { EventType } from '@prisma/client';

export class TransitionCaseDto {
  @IsEnum(EventType)
  eventType!: EventType;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}
