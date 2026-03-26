import { Controller, Post, Get, Param, Body, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { AppendEventDto } from './dto/append-event.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Ledger')
@ApiBearerAuth()
@Controller('cases/:caseId/events')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post()
  async appendEvent(
    @Param('caseId') caseId: string,
    @Body() dto: AppendEventDto,
    @Request() req: any,
  ) {
    return this.ledgerService.appendEvent(caseId, req.user.sub, dto.eventType, dto.payload);
  }

  @Get()
  async findAll(@Param('caseId') caseId: string) {
    return this.ledgerService.findAllByCaseId(caseId);
  }

  @Get('verify')
  @Roles(UserRole.ADMIN)
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
