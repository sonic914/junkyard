import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { AppendEventDto } from './dto/append-event.dto';

@Controller('cases/:caseId/events')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post()
  async appendEvent(
    @Param('caseId') caseId: string,
    @Body() dto: AppendEventDto,
  ) {
    // TODO: actorId는 JWT에서 추출 — CP1에서는 임시로 body 또는 하드코딩
    const actorId = 'temp-actor-id';
    return this.ledgerService.appendEvent(caseId, actorId, dto.eventType, dto.payload);
  }

  @Get()
  async findAll(@Param('caseId') caseId: string) {
    return this.ledgerService.findAllByCaseId(caseId);
  }

  @Get('verify')
  async verify(@Param('caseId') caseId: string) {
    const result = await this.ledgerService.verifyChain(caseId);
    const events = await this.ledgerService.findAllByCaseId(caseId);
    return {
      caseId,
      totalEvents: events.length,
      ...result,
    };
  }
}
