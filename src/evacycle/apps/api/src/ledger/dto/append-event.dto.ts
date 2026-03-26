import { IsEnum, IsObject } from 'class-validator';
import { EventType } from '@prisma/client';

export class AppendEventDto {
  @IsEnum(EventType)
  eventType!: EventType;

  @IsObject()
  payload!: Record<string, unknown>;
}
